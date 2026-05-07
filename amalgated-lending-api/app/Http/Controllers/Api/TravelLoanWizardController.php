<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\LoanApplicationReceivedMail;
use App\Models\AdminNotification;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanApplicationContactPerson;
use App\Models\LoanApplicationDependent;
use App\Models\LoanCreditMemorandum;
use App\Models\LoanDocument;
use App\Models\Role;
use App\Models\TravelLoanWizardForm;
use App\Models\User;
use App\Services\BrevoMailService;
use App\Services\LoanProductRateResolver;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * Public Travel Assistance wizard (multi-section form + uploads).
 */
class TravelLoanWizardController extends Controller
{
    private const MAX_PRINCIPAL = 2_000_000.0;

    public function __construct(
        private BrevoMailService $brevo,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    public function apply(Request $request): JsonResponse
    {
        $rules = [
            'password' => 'required|string|min:8|max:72',
            'wizard_payload' => 'required|string',
            'terms_accepted' => 'required|accepted',
            'signature_data' => 'nullable|string',
            'signature_date' => 'nullable|date',
            'passport_photo_1' => 'nullable|file|mimes:jpg,jpeg,png|max:15360',
            'passport_photo_2' => 'nullable|file|mimes:jpg,jpeg,png|max:15360',
            'passport_photo_3' => 'nullable|file|mimes:jpg,jpeg,png|max:15360',
            'passport_copy' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'valid_id_1' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'valid_id_2' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'community_tax_certificate' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'residence_sketch' => 'nullable|file|mimes:jpg,jpeg,png|max:15360',
        ];

        $request->validate($rules);

        $wizard = json_decode($request->input('wizard_payload'), true);
        if (! is_array($wizard)) {
            return response()->json(['ok' => false, 'message' => 'Invalid wizard_payload JSON.'], 422);
        }

        $err = $this->validateWizardStructure($wizard);
        if ($err !== null) {
            return response()->json(['ok' => false, 'message' => $err, 'errors' => ['wizard' => [$err]]], 422);
        }

        $loan = $wizard['loan'] ?? [];
        $personal = $wizard['personal'] ?? [];
        $principal = (float) $loan['amount_of_loan'];
        $termMonths = (int) $loan['desired_term'];
        $country = trim((string) $loan['country_destination']);
        $purpose = trim((string) $loan['purpose_of_loan']);
        $travelDate = ! empty($loan['travel_date']) ? Carbon::parse($loan['travel_date'])->startOfDay() : now()->addDay()->startOfDay();

        if ($principal > self::MAX_PRINCIPAL + 0.009) {
            return response()->json([
                'ok' => false,
                'message' => 'Travel assistance loan cannot exceed ₱'.number_format(self::MAX_PRINCIPAL, 2).' per policy.',
            ], 422);
        }

        if ($travelDate->lt(now()->startOfDay())) {
            return response()->json(['ok' => false, 'message' => 'Travel date must be today or a future date.'], 422);
        }

        $email = mb_strtolower(trim((string) ($personal['email'] ?? '')));
        $fullName = $this->buildFullName($personal);
        $phone = trim((string) ($personal['mobile_no'] ?? $personal['telephone_no'] ?? ''));
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('travel-assistance-loan', 3.5, $termMonths);
        $annualRatePercent = $monthlyRatePercent * 12;

        try {
            $result = DB::transaction(function () use ($request, $wizard, $principal, $termMonths, $country, $purpose, $travelDate, $email, $fullName, $phone, $monthlyRatePercent, $annualRatePercent) {
                $borrower = User::firstOrCreate(
                    ['email' => $email],
                    [
                        'name' => $fullName,
                        'password' => Hash::make((string) ($request->input('password') ?? Str::random(32))),
                        'role' => 'borrower',
                        'phone' => $phone ?: null,
                        'is_active' => true,
                    ]
                );

                if (! $borrower->wasRecentlyCreated) {
                    $borrower->fill(['name' => $fullName, 'phone' => $phone ?: $borrower->phone]);
                    if ($request->filled('password')) {
                        $borrower->password = Hash::make((string) $request->input('password'));
                    }
                    $borrower->save();
                }

                $borrowerRole = Role::where('slug', 'borrower')->first();
                if ($borrowerRole) {
                    $borrower->roles()->syncWithoutDetaching([$borrowerRole->id]);
                }

                $payload = $wizard;
                $payload['loan_product_slug'] = 'travel-assistance-loan';
                $payload['loan_product_type'] = LoanApplication::TYPE_TRAVEL_ASSISTANCE;
                $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
                $payload['selected_rate_type'] = 'monthly';
                $payload['destination_country'] = $country;
                $payload['travel_date'] = $travelDate->toDateString();
                $payload['purpose'] = $purpose;
                $payload['wizard_version'] = 2;

                $loan = Loan::create([
                    'borrower_id' => $borrower->id,
                    'principal' => $principal,
                    'term_months' => max(1, $termMonths),
                    'annual_interest_rate' => $annualRatePercent,
                    'status' => Loan::STATUS_PENDING,
                    'application_payload' => $payload,
                ]);

                $loanApp = LoanApplication::create([
                    'user_id' => $borrower->id,
                    'loan_id' => $loan->id,
                    'loan_type' => LoanApplication::TYPE_TRAVEL_ASSISTANCE,
                    'co_maker_id' => null,
                    'co_maker_name' => null,
                    'co_maker_email' => null,
                    'co_maker_phone' => null,
                    'tin_number' => isset($wizard['employment']['tin']) ? trim((string) $wizard['employment']['tin']) : null,
                    'stencil_text' => null,
                    'destination_country' => $country,
                    'travel_date' => $travelDate->toDateString(),
                    'purpose' => $purpose,
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                TravelLoanWizardForm::create([
                    'loan_application_id' => $loanApp->id,
                    'wizard_data' => $wizard,
                    'terms_accepted' => true,
                    'terms_accepted_at' => now(),
                    'signature_data' => $request->input('signature_data'),
                    'signature_date' => $request->input('signature_date') ? Carbon::parse($request->input('signature_date'))->toDateString() : now()->toDateString(),
                ]);

                $this->syncDependents($loanApp->id, $wizard['dependents'] ?? []);
                $this->syncContacts($loanApp->id, $wizard['contact_persons'] ?? []);

                $baseDir = "travel-assistance-applications/{$loanApp->id}";
                $kycMirror = [];

                $fileMap = [
                    'passport_photo_1' => 'passport_photo_1',
                    'passport_photo_2' => 'passport_photo_2',
                    'passport_photo_3' => 'passport_photo_3',
                    'passport_copy' => 'passport_copy',
                    'valid_id_1' => 'valid_id_1',
                    'valid_id_2' => 'valid_id_2',
                    'community_tax_certificate' => 'community_tax_certificate',
                    'residence_sketch' => 'residence_sketch',
                ];

                foreach ($fileMap as $field => $type) {
                    if (! $request->hasFile($field)) {
                        continue;
                    }
                    $file = $request->file($field);
                    $path = $file->store($baseDir, 'public');
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => $type,
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => $type,
                        'label' => $type,
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                $loan->kyc_documents = $kycMirror;
                $loan->save();

                LoanCreditMemorandum::firstOrCreate(
                    ['loan_application_id' => $loanApp->id],
                    [
                        'date_application_received' => now()->toDateString(),
                        'application_status' => 'complete',
                        'documents_status' => 'pending_review',
                        'payments_status' => 'n/a',
                    ]
                );

                return [$borrower, $loan, $loanApp];
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['ok' => false, 'message' => 'Could not save application.'], 500);
        }

        [$borrower, $loan, $loanApp] = $result;

        AdminNotification::create([
            'user_id' => null,
            'type' => 'loan_submitted',
            'title' => 'Travel Assistance (wizard)',
            'body' => 'New travel application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
            'data' => ['loan_id' => $loan->id, 'loan_application_id' => $loanApp->id],
        ]);

        $this->notifyBorrower($borrower, $loan);

        return response()->json([
            'ok' => true,
            'loan_id' => $loan->id,
            'loan_application_id' => $loanApp->id,
        ], 201);
    }

    private function validateWizardStructure(array $w): ?string
    {
        $loan = $w['loan'] ?? null;
        if (! is_array($loan)) {
            return 'Loan details section is required.';
        }
        foreach (['amount_of_loan', 'purpose_of_loan', 'desired_term', 'country_destination', 'travel_date'] as $k) {
            if (! isset($loan[$k]) || $loan[$k] === '' || $loan[$k] === null) {
                return "Loan field {$k} is required.";
            }
        }
        if (strlen(trim((string) $loan['purpose_of_loan'])) < 10) {
            return 'Purpose of loan must be at least 10 characters.';
        }
        if ((float) $loan['amount_of_loan'] < 1000) {
            return 'Minimum loan amount is ₱1,000.';
        }
        if ((int) $loan['desired_term'] !== 1) {
            return 'Travel Assistance uses a 1-month term (monthly renewal).';
        }

        $p = $w['personal'] ?? null;
        if (! is_array($p)) {
            return 'Personal data section is required.';
        }
        foreach (['email', 'last_name', 'first_name', 'mobile_no', 'home_address', 'city', 'province'] as $k) {
            if (! isset($p[$k]) || trim((string) $p[$k]) === '') {
                return "Personal field {$k} is required.";
            }
        }

        $e = $w['employment'] ?? null;
        if (! is_array($e)) {
            return 'Employment information is required.';
        }
        foreach (['employment_type', 'tin', 'sss_gsis', 'employer_name', 'employer_address', 'employer_tel', 'start_date', 'position'] as $k) {
            if (! isset($e[$k]) || trim((string) $e[$k]) === '') {
                return "Employment field {$k} is required.";
            }
        }

        return null;
    }

    private function buildFullName(array $personal): string
    {
        $parts = array_filter([
            trim((string) ($personal['first_name'] ?? '')),
            trim((string) ($personal['middle_name'] ?? '')),
            trim((string) ($personal['last_name'] ?? '')),
        ]);

        return implode(' ', $parts) ?: 'Applicant';
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function syncDependents(int $loanApplicationId, array $rows): void
    {
        LoanApplicationDependent::where('loan_application_id', $loanApplicationId)->delete();
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            LoanApplicationDependent::create([
                'loan_application_id' => $loanApplicationId,
                'name' => $name,
                'birthdate' => ! empty($row['birthdate']) ? Carbon::parse($row['birthdate'])->toDateString() : null,
                'school_or_work' => isset($row['school_or_work']) ? trim((string) $row['school_or_work']) : null,
            ]);
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function syncContacts(int $loanApplicationId, array $rows): void
    {
        LoanApplicationContactPerson::where('loan_application_id', $loanApplicationId)->delete();
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            if ($name === '') {
                continue;
            }
            LoanApplicationContactPerson::create([
                'loan_application_id' => $loanApplicationId,
                'name' => $name,
                'birthdate' => ! empty($row['birthdate']) ? Carbon::parse($row['birthdate'])->toDateString() : null,
                'school_or_work' => isset($row['school_or_work']) ? trim((string) $row['school_or_work']) : null,
            ]);
        }
    }

    private function notifyBorrower(User $borrower, Loan $loan): void
    {
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new LoanApplicationReceivedMail($loan, (string) $borrower->name);
        $subject = 'We received your Travel Assistance Loan application — Amalgated Lending';

        if ($this->brevo->isConfigured()) {
            try {
                $html = $mailable->render();
                $this->brevo->sendHtml($email, $borrower->name, $subject, $html);

                return;
            } catch (\Throwable $e) {
                report($e);
            }
        }

        try {
            Mail::to($email)->send($mailable);
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
