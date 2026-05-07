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

class RealEstateMortgageController extends Controller
{
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
            'term_months' => 'required|integer|min:1|max:36',
            'application_payload' => 'nullable|string',
            'property_location' => 'required|string|max:512',
            'property_value' => 'required|numeric|min:0',
            'tin_number' => 'nullable|string|max:64',
            'doc_application_form' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_government_id' => 'nullable|array|max:2',
            'doc_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_ctc' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_tax_declaration' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_picture_2x2' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
            'doc_vicinity_map' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_marriage_contract' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_tin' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'doc_tax_clearance' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_bank_statement' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_billing' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_income' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ];

        $data = $request->validate($rules);

        $tinText = trim((string) ($data['tin_number'] ?? ''));

        $payload = $this->decodeApplicationPayload($data['application_payload'] ?? null);
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('real-estate-mortgage', 3.88, (int) $data['term_months']);
        $annualRatePercent = $monthlyRatePercent * 12;
        $payload['loan_product_slug'] = 'real-estate-mortgage';
        $payload['loan_product_type'] = LoanApplication::TYPE_REAL_ESTATE;
        $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
        $payload['selected_rate_type'] = 'monthly';
        $payload['property_location'] = trim($data['property_location']);
        $payload['property_value'] = (float) $data['property_value'];

        $applicantEmail = mb_strtolower(trim($data['email']));

        try {
            $result = DB::transaction(function () use ($request, $data, $payload, $applicantEmail, $tinText, $annualRatePercent) {
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
                    'loan_type' => LoanApplication::TYPE_REAL_ESTATE,
                    'co_maker_id' => null,
                    'co_maker_name' => null,
                    'co_maker_email' => null,
                    'co_maker_phone' => null,
                    'tin_number' => $tinText !== '' ? $tinText : null,
                    'stencil_text' => null,
                    'property_location' => trim($data['property_location']),
                    'property_value' => $data['property_value'],
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                $baseDir = "rem-applications/{$loanApp->id}";
                $kycMirror = [];

                $docMap = [
                    'doc_application_form' => 'application_form',
                    'doc_ctc' => 'ctc',
                    'doc_tax_declaration' => 'tax_declaration',
                    'doc_picture_2x2' => 'picture_2x2',
                    'doc_vicinity_map' => 'vicinity_map',
                    'doc_bank_statement' => 'bank_statement',
                    'doc_proof_of_billing' => 'proof_of_billing',
                    'doc_proof_of_income' => 'proof_of_income',
                ];

                foreach ($docMap as $field => $type) {
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

                foreach (['doc_marriage_contract' => 'marriage_contract', 'doc_tin' => 'tin', 'doc_tax_clearance' => 'tax_clearance'] as $field => $type) {
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

                return [$borrower, $loan, $loanApp];
            });
        } catch (\InvalidArgumentException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

        [$borrower, $loan, $loanApp] = $result;

        AdminNotification::create([
            'user_id' => null,
            'type' => 'loan_submitted',
            'title' => 'Real Estate Mortgage application',
            'body' => 'New REM application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
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
        $subject = 'We received your Real Estate Mortgage application — Amalgated Lending';

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
