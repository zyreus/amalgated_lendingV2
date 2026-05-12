<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\LoanApplicationReceivedMail;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Models\Role;
use App\Models\User;
use App\Services\BrevoMailService;
use App\Services\LoanProductRateResolver;
use App\Services\NotificationCenter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class TravelAssistanceController extends Controller
{
    private const MAX_PRINCIPAL = 2_000_000.0;

    private const BANK_STATEMENT_MONTHS_REQUIRED = 4;

    public function __construct(
        private BrevoMailService $brevo,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    public function apply(Request $request): JsonResponse
    {
        $rules = [
            'email' => 'required|email',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:32',
            'password' => 'required|string|min:8|max:72',
            'principal' => 'required|numeric|min:1000',
            'term_months' => 'required|integer|in:1',
            'application_payload' => 'nullable|string',
            'destination_country' => 'required|string|min:2|max:120',
            'travel_date' => 'required|date',
            'purpose' => 'required|string|min:10|max:2000',
            'tin_number' => 'nullable|string|max:64',
            'doc_application_form' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_government_id' => 'nullable|array|max:2',
            'doc_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_or_cr' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_picture_2x2' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
            'doc_tin' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'doc_bank_statement' => 'nullable|array|max:'.self::BANK_STATEMENT_MONTHS_REQUIRED,
            'doc_bank_statement.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_billing' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ];

        $data = $request->validate($rules);

        if ((float) $data['principal'] > self::MAX_PRINCIPAL + 0.009) {
            return response()->json([
                'ok' => false,
                'message' => 'Travel assistance loan cannot exceed ₱'.number_format(self::MAX_PRINCIPAL, 2).' per policy.',
            ], 422);
        }

        $travelDay = Carbon::parse($data['travel_date'])->startOfDay();
        if ($travelDay->lt(now()->startOfDay())) {
            return response()->json([
                'ok' => false,
                'message' => 'Travel date must be today or a future date.',
            ], 422);
        }

        $country = trim($data['destination_country']);
        if (strlen($country) < 2) {
            return response()->json([
                'ok' => false,
                'message' => 'Please enter a valid destination country.',
            ], 422);
        }

        $payload = $this->decodeApplicationPayload($data['application_payload'] ?? null);
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('travel-assistance-loan', 3.5, (int) $data['term_months']);
        $annualRatePercent = $monthlyRatePercent * 12;
        $payload['loan_product_slug'] = 'travel-assistance-loan';
        $payload['loan_product_type'] = LoanApplication::TYPE_TRAVEL_ASSISTANCE;
        $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
        $payload['selected_rate_type'] = 'monthly';
        $payload['destination_country'] = $country;
        $payload['travel_date'] = $travelDay->toDateString();
        $payload['purpose'] = trim($data['purpose']);
        $payload['bank_statement_months_required'] = self::BANK_STATEMENT_MONTHS_REQUIRED;
        $payload['max_principal_policy'] = self::MAX_PRINCIPAL;
        $payload['term_structure'] = 'monthly_renewal';

        $applicantEmail = mb_strtolower(trim($data['email']));
        $tinText = trim((string) ($data['tin_number'] ?? ''));

        try {
            $result = DB::transaction(function () use ($request, $data, $payload, $applicantEmail, $tinText, $country, $travelDay, $annualRatePercent) {
                $borrower = User::firstOrCreate(
                    ['email' => $applicantEmail],
                    [
                        'name' => $data['name'],
                        'password' => Hash::make((string) ($data['password'] ?? Str::random(32))),
                        'role' => 'borrower',
                        'phone' => $data['phone'] ?? null,
                        'is_active' => true,
                    ]
                );

                if (! $borrower->wasRecentlyCreated) {
                    $borrower->fill([
                        'name' => $data['name'],
                        'phone' => $data['phone'] ?? $borrower->phone,
                    ]);
                    if (! empty($data['password'])) {
                        $borrower->password = Hash::make((string) $data['password']);
                    }
                    $borrower->save();
                }

                $borrowerRole = Role::where('slug', 'borrower')->first();
                if ($borrowerRole) {
                    $borrower->roles()->syncWithoutDetaching([$borrowerRole->id]);
                }

                $loan = Loan::create([
                    'borrower_id' => $borrower->id,
                    'principal' => $data['principal'],
                    'term_months' => $data['term_months'],
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
                    'tin_number' => $tinText !== '' ? $tinText : null,
                    'stencil_text' => null,
                    'destination_country' => $country,
                    'travel_date' => $travelDay->toDateString(),
                    'purpose' => trim($data['purpose']),
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                $baseDir = "travel-assistance-applications/{$loanApp->id}";
                $kycMirror = [];

                foreach ([
                    'doc_application_form' => 'application_form',
                    'doc_picture_2x2' => 'picture_2x2',
                    'doc_proof_of_billing' => 'proof_of_billing',
                ] as $field => $type) {
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

                if ($request->hasFile('doc_or_cr')) {
                    $file = $request->file('doc_or_cr');
                    $path = $file->store($baseDir, 'public');
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => 'or_cr',
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => 'or_cr',
                        'label' => 'OR/CR',
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                if ($request->hasFile('doc_tin')) {
                    $file = $request->file('doc_tin');
                    $path = $file->store($baseDir, 'public');
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => 'tin',
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => 'tin',
                        'label' => 'TIN ID',
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                $bankFiles = $request->file('doc_bank_statement', []);
                foreach ($bankFiles as $i => $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store("{$baseDir}/bank-statements", 'public');
                    $monthIndex = $i + 1;
                    $type = 'bank_statement_month_'.$monthIndex;
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => $type,
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => $type,
                        'label' => 'Bank statement month '.$monthIndex,
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                $govFiles = $request->file('doc_government_id', []);
                foreach ($govFiles as $i => $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store("{$baseDir}/ids", 'public');
                    $type = 'government_id_'.($i + 1);
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => $type,
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => $type,
                        'label' => 'Government ID '.($i + 1),
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                $loan->kyc_documents = $kycMirror;
                $loan->save();

                return [$borrower, $loan, $loanApp];
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        [$borrower, $loan, $loanApp] = $result;

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_SUBMITTED,
            'loan_submitted',
            'Travel Assistance loan application',
            'New travel assistance application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
            ['loan_id' => $loan->id, 'loan_application_id' => $loanApp->id],
            null,
            ['module' => NotificationCenter::MODULE_LOANS],
        );

        $this->notifyBorrower($borrower, $loan);

        return response()->json([
            'ok' => true,
            'loan_id' => $loan->id,
            'loan_application_id' => $loanApp->id,
        ], 201);
    }

    private function decodeApplicationPayload(?string $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function notifyBorrower(User $borrower, Loan $loan): void
    {
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new LoanApplicationReceivedMail($loan, (string) $borrower->name);
        $subject = 'We received your Travel Assistance Loan application — Amalgated Lending Inc.';

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
