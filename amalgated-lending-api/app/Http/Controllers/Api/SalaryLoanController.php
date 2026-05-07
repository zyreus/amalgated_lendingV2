<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\LoanApplicationReceivedMail;
use App\Models\AdminNotification;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Models\Role;
use App\Models\User;
use App\Services\BrevoMailService;
use App\Services\LoanProductRateResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class SalaryLoanController extends Controller
{
    /** Max principal = monthly gross salary × this multiplier (debt-service cap). */
    private const SALARY_TO_PRINCIPAL_MULTIPLIER = 6.0;

    public function __construct(
        private BrevoMailService $brevo,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    public static function maxPrincipalForMonthlySalary(float $monthlySalary): float
    {
        if ($monthlySalary <= 0) {
            return 0.0;
        }

        return floor($monthlySalary * self::SALARY_TO_PRINCIPAL_MULTIPLIER * 100) / 100;
    }

    public function apply(Request $request): JsonResponse
    {
        $rules = [
            'email' => 'required|email',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:32',
            'password' => 'required|string|min:8|max:72',
            'principal' => 'required|numeric|min:1000',
            'term_months' => 'required|integer|min:1|max:360',
            'application_payload' => 'nullable|string',
            'employer_name' => 'required|string|max:255',
            'monthly_salary' => 'required|numeric|min:1',
            'co_maker_id' => 'nullable|integer|exists:users,id',
            'co_maker_name' => 'required_without:co_maker_id|nullable|string|max:255',
            'co_maker_email' => [
                'required_without:co_maker_id',
                'nullable',
                'email',
            ],
            'co_maker_phone' => 'required_without:co_maker_id|nullable|string|max:32',
            'doc_application_form' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_borrower_government_id' => 'nullable|array|max:2',
            'doc_borrower_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_co_maker_government_id' => 'nullable|array|max:2',
            'doc_co_maker_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_payslip_borrower' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_payslip_co_maker' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_billing' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_barangay_certification' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ];

        $data = $request->validate($rules);

        $monthlySalary = (float) $data['monthly_salary'];
        $maxPrincipal = self::maxPrincipalForMonthlySalary($monthlySalary);
        if ((float) $data['principal'] > $maxPrincipal + 0.009) {
            return response()->json([
                'ok' => false,
                'message' => 'Loan amount exceeds the maximum allowed for your declared monthly salary (₱'.number_format($maxPrincipal, 2).').',
                'max_principal' => $maxPrincipal,
            ], 422);
        }

        $payload = $this->decodeApplicationPayload($data['application_payload'] ?? null);
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('salary-loan', 1.5, (int) $data['term_months']);
        $annualRatePercent = $monthlyRatePercent * 12;
        $payload['loan_product_slug'] = 'salary-loan';
        $payload['loan_product_type'] = LoanApplication::TYPE_SALARY;
        $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
        $payload['selected_rate_type'] = 'monthly';
        $payload['employer_name'] = trim($data['employer_name']);
        $payload['monthly_salary'] = $monthlySalary;
        $payload['calculated_max_principal'] = $maxPrincipal;
        $payload['salary_principal_multiplier'] = self::SALARY_TO_PRINCIPAL_MULTIPLIER;

        $applicantEmail = mb_strtolower(trim($data['email']));
        $coMakerEmail = isset($data['co_maker_email']) ? mb_strtolower(trim((string) $data['co_maker_email'])) : '';

        if ($coMakerEmail !== '' && $coMakerEmail === $applicantEmail) {
            return response()->json([
                'ok' => false,
                'message' => 'Co-maker must use a different email than the applicant.',
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($request, $data, $payload, $applicantEmail, $coMakerEmail, $monthlySalary, $annualRatePercent) {
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

                $coMakerId = $data['co_maker_id'] ?? null;
                if ($coMakerId) {
                    if ((int) $coMakerId === (int) $borrower->id) {
                        throw new \InvalidArgumentException('Co-maker cannot be the same as the applicant.');
                    }
                } else {
                    $cm = User::firstOrCreate(
                        ['email' => $coMakerEmail],
                        [
                            'name' => $data['co_maker_name'],
                            'password' => Hash::make(Str::random(32)),
                            'role' => 'borrower',
                            'phone' => $data['co_maker_phone'] ?? null,
                            'is_active' => true,
                        ]
                    );
                    if (! $cm->wasRecentlyCreated) {
                        $cm->fill([
                            'name' => $data['co_maker_name'],
                            'phone' => $data['co_maker_phone'] ?? $cm->phone,
                        ]);
                        $cm->save();
                    }
                    if ($borrowerRole) {
                        $cm->roles()->syncWithoutDetaching([$borrowerRole->id]);
                    }
                    $coMakerId = $cm->id;
                    if ((int) $coMakerId === (int) $borrower->id) {
                        throw new \InvalidArgumentException('Co-maker cannot be the same as the applicant.');
                    }
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
                    'loan_type' => LoanApplication::TYPE_SALARY,
                    'co_maker_id' => $coMakerId,
                    'co_maker_name' => $data['co_maker_name'] ?? null,
                    'co_maker_email' => $coMakerEmail !== '' ? $coMakerEmail : null,
                    'co_maker_phone' => $data['co_maker_phone'] ?? null,
                    'employer_name' => trim($data['employer_name']),
                    'monthly_salary' => $monthlySalary,
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                $kycMirror = [];
                $baseDir = "salary-loan-applications/{$loanApp->id}";

                foreach ([
                    'doc_application_form' => 'application_form',
                    'doc_payslip_borrower' => 'payslip_borrower',
                    'doc_payslip_co_maker' => 'payslip_co_maker',
                    'doc_proof_of_billing' => 'proof_of_billing',
                    'doc_barangay_certification' => 'barangay_certification',
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

                $borrowerGov = $request->file('doc_borrower_government_id', []);
                foreach ($borrowerGov as $i => $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store("{$baseDir}/borrower-ids", 'public');
                    $type = 'borrower_government_id_'.($i + 1);
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => $type,
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => $type,
                        'label' => 'Borrower government ID '.($i + 1),
                        'path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ];
                }

                $coMakerGov = $request->file('doc_co_maker_government_id', []);
                foreach ($coMakerGov as $i => $file) {
                    if (! $file || ! $file->isValid()) {
                        continue;
                    }
                    $path = $file->store("{$baseDir}/co-maker-ids", 'public');
                    $type = 'co_maker_government_id_'.($i + 1);
                    LoanDocument::create([
                        'loan_application_id' => $loanApp->id,
                        'document_type' => $type,
                        'file_path' => $path,
                        'original_name' => $file->getClientOriginalName(),
                    ]);
                    $kycMirror[] = [
                        'key' => $type,
                        'label' => 'Co-maker government ID '.($i + 1),
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

        /** @var User $borrower */
        /** @var Loan $loan */
        /** @var LoanApplication $loanApp */
        [$borrower, $loan, $loanApp] = $result;

        AdminNotification::create([
            'user_id' => null,
            'type' => 'loan_submitted',
            'title' => 'Salary loan application',
            'body' => 'New salary loan application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
            'data' => ['loan_id' => $loan->id, 'loan_application_id' => $loanApp->id],
        ]);

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
        $subject = 'We received your Salary Loan application — Amalgated Lending';

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
