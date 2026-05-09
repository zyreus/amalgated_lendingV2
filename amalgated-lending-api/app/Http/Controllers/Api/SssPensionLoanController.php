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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class SssPensionLoanController extends Controller
{
    private const BANK_STATEMENT_MONTHS_REQUIRED = 4;

    private const MAX_AGE = 70;

    private const MAX_TERM_MONTHS = 36;

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
            'term_months' => 'required|integer|min:1|max:'.self::MAX_TERM_MONTHS,
            'application_payload' => 'nullable|string',
            'pension_type' => ['required', 'string', Rule::in(['SSS', 'GSIS'])],
            'monthly_pension' => 'required|numeric|min:1',
            'age' => 'required|integer|min:18|max:'.self::MAX_AGE,
            'co_maker_id' => 'nullable|integer|exists:users,id',
            'co_maker_name' => 'nullable|string|max:255',
            'co_maker_email' => 'nullable|email',
            'co_maker_phone' => 'nullable|string|max:32',
            'doc_application_form' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_government_id' => 'nullable|array|max:2',
            'doc_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_birth_certificate_psa' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_marriage_contract' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_picture_2x2' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
            'doc_proof_of_billing' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_pension_verification' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_bank_statement' => 'nullable|array|max:'.self::BANK_STATEMENT_MONTHS_REQUIRED,
            'doc_bank_statement.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ];

        $data = $request->validate($rules);

        $age = (int) $data['age'];

        $coMakerResolution = $this->resolveOptionalCoMaker($data);
        if ($coMakerResolution instanceof JsonResponse) {
            return $coMakerResolution;
        }
        /** @var array{0: ?int, 1: ?string, 2: ?string, 3: ?string} $coMakerResolution */
        [$coMakerId, $coMakerNameStored, $coMakerEmailStored, $coMakerPhoneStored] = $coMakerResolution;

        $payload = $this->decodeApplicationPayload($data['application_payload'] ?? null);
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('sss-pension-loan', 2.24, (int) $data['term_months']);
        $annualRatePercent = $monthlyRatePercent * 12;
        $payload['loan_product_slug'] = 'sss-pension-loan';
        $payload['loan_product_type'] = LoanApplication::TYPE_SSS_PENSION;
        $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
        $payload['selected_rate_type'] = 'monthly';
        $payload['pension_type'] = $data['pension_type'];
        $payload['monthly_pension'] = (float) $data['monthly_pension'];
        $payload['age'] = $age;
        $payload['bank_statement_months_required'] = self::BANK_STATEMENT_MONTHS_REQUIRED;

        $applicantEmail = mb_strtolower(trim($data['email']));

        try {
            $result = DB::transaction(function () use (
                $request,
                $data,
                $payload,
                $applicantEmail,
                $coMakerId,
                $coMakerNameStored,
                $coMakerEmailStored,
                $coMakerPhoneStored,
                $age,
                $annualRatePercent
            ) {
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

                if ($coMakerId !== null && (int) $coMakerId === (int) $borrower->id) {
                    throw new \InvalidArgumentException('Co-maker cannot be the same as the applicant.');
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
                    'loan_type' => LoanApplication::TYPE_SSS_PENSION,
                    'co_maker_id' => $coMakerId,
                    'co_maker_name' => $coMakerNameStored,
                    'co_maker_email' => $coMakerEmailStored,
                    'co_maker_phone' => $coMakerPhoneStored,
                    'tin_number' => null,
                    'stencil_text' => null,
                    'pension_type' => $data['pension_type'],
                    'monthly_pension' => $data['monthly_pension'],
                    'age' => $age,
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                $baseDir = "sss-pension-applications/{$loanApp->id}";
                $kycMirror = [];

                foreach ([
                    'doc_application_form' => 'application_form',
                    'doc_birth_certificate_psa' => 'birth_certificate_psa',
                    'doc_picture_2x2' => 'picture_2x2',
                    'doc_proof_of_billing' => 'proof_of_billing',
                    'doc_pension_verification' => 'pension_verification',
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
                        'label' => str_replace('_', ' ', $type),
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                if ($request->hasFile('doc_marriage_contract')) {
                    $file = $request->file('doc_marriage_contract');
                    $path = $file->store($baseDir, 'public');
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => 'marriage_contract',
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => 'marriage_contract',
                        'label' => 'Marriage contract',
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
            'SSS Pension loan application',
            'New SSS/GSIS pension loan application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
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

    /**
     * @return JsonResponse|array{0: ?int, 1: ?string, 2: ?string, 3: ?string}
     */
    private function resolveOptionalCoMaker(array $data): JsonResponse|array
    {
        $coMakerId = ! empty($data['co_maker_id']) ? (int) $data['co_maker_id'] : null;
        if ($coMakerId) {
            return [$coMakerId, null, null, null];
        }

        $name = trim((string) ($data['co_maker_name'] ?? ''));
        $email = mb_strtolower(trim((string) ($data['co_maker_email'] ?? '')));
        $phone = trim((string) ($data['co_maker_phone'] ?? ''));

        if ($name === '' && $email === '' && $phone === '') {
            return [null, null, null, null];
        }

        if ($name === '' || $email === '' || $phone === '') {
            return response()->json([
                'ok' => false,
                'message' => 'Provide complete co-maker details (name, email, and phone) or leave co-maker blank.',
            ], 422);
        }

        $borrowerEmail = mb_strtolower(trim((string) $data['email']));
        if ($email === $borrowerEmail) {
            return response()->json([
                'ok' => false,
                'message' => 'Co-maker must use a different email than the applicant.',
            ], 422);
        }

        $borrowerRole = Role::where('slug', 'borrower')->first();
        $cm = User::firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => Hash::make(Str::random(32)),
                'role' => 'borrower',
                'phone' => $phone,
                'is_active' => true,
            ]
        );
        if (! $cm->wasRecentlyCreated) {
            $cm->fill(['name' => $name, 'phone' => $phone]);
            $cm->save();
        }
        if ($borrowerRole) {
            $cm->roles()->syncWithoutDetaching([$borrowerRole->id]);
        }

        return [$cm->id, $name, $email, $phone];
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
        $subject = 'We received your SSS Pension Loan application — Amalgated Lending';

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
