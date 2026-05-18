<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Models\Role;
use App\Models\User;
use App\Services\LoanApplicationMailNotifier;
use App\Services\LoanProductRateResolver;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ChattelMortgageController extends Controller
{
    public function __construct(
        private LoanApplicationMailNotifier $loanMail,
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
            'tin_number' => 'nullable|string|max:64',
            'stencil_text' => 'nullable|string|max:5000',
            'co_maker_id' => 'nullable|integer|exists:users,id',
            'co_maker_name' => 'required_without:co_maker_id|nullable|string|max:255',
            'co_maker_email' => [
                'required_without:co_maker_id',
                'nullable',
                'email',
            ],
            'co_maker_phone' => 'required_without:co_maker_id|nullable|string|max:32',
            'doc_application_form' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_government_id' => 'nullable|array|max:2',
            'doc_government_id.*' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_or_cr' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_picture_2x2' => 'nullable|file|mimes:jpg,jpeg,png|max:5120',
            'doc_stencil' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'doc_marriage_contract' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_tin' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:10240',
            'doc_bank_statement' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_billing' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
            'doc_proof_of_income' => 'nullable|file|mimes:jpg,jpeg,png,pdf|max:15360',
        ];

        $data = $request->validate($rules);
        $payload = $this->decodeApplicationPayload($data['application_payload'] ?? null);
        $monthlyRatePercent = $this->loanProductRates->resolveMonthlyRatePercent('chattel-mortgage', 3.88, (int) $data['term_months']);
        $annualRatePercent = $monthlyRatePercent * 12;
        $payload['loan_product_slug'] = 'chattel-mortgage';
        $payload['loan_product_type'] = LoanApplication::TYPE_CHATTEL;
        $payload['selected_interest_rate'] = round($monthlyRatePercent, 4);
        $payload['selected_rate_type'] = 'monthly';

        $applicantEmail = mb_strtolower(trim($data['email']));
        $coMakerEmail = isset($data['co_maker_email']) ? mb_strtolower(trim((string) $data['co_maker_email'])) : '';

        if ($coMakerEmail !== '' && $coMakerEmail === $applicantEmail) {
            return response()->json([
                'ok' => false,
                'message' => 'Co-maker must use a different email than the applicant.',
            ], 422);
        }

        try {
            $result = DB::transaction(function () use ($request, $data, $payload, $applicantEmail, $coMakerEmail, $annualRatePercent) {
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
                    'loan_type' => LoanApplication::TYPE_CHATTEL,
                    'co_maker_id' => $coMakerId,
                    'co_maker_name' => $data['co_maker_name'] ?? null,
                    'co_maker_email' => $coMakerEmail !== '' ? $coMakerEmail : null,
                    'co_maker_phone' => $data['co_maker_phone'] ?? null,
                    'tin_number' => $data['tin_number'] ?? null,
                    'stencil_text' => isset($data['stencil_text']) ? trim((string) $data['stencil_text']) : null,
                    'form_data' => $payload,
                    'status' => LoanApplication::STATUS_PENDING,
                ]);

                $docMap = [
                    'doc_application_form' => 'application_form',
                    'doc_or_cr' => 'or_cr',
                    'doc_picture_2x2' => 'picture_2x2',
                    'doc_bank_statement' => 'bank_statement',
                    'doc_proof_of_billing' => 'proof_of_billing',
                    'doc_proof_of_income' => 'proof_of_income',
                ];

                $kycMirror = [];

                foreach ($docMap as $field => $type) {
                    if (! $request->hasFile($field)) {
                        continue;
                    }
                    $file = $request->file($field);
                    $path = $file->store("chattel-applications/{$loanApp->id}", 'public');
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
                    $path = $file->store("chattel-applications/{$loanApp->id}/ids", 'public');
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

                foreach (['doc_stencil' => 'stencil', 'doc_marriage_contract' => 'marriage_contract', 'doc_tin' => 'tin'] as $field => $type) {
                    if (! $request->hasFile($field)) {
                        continue;
                    }
                    $file = $request->file($field);
                    $path = $file->store("chattel-applications/{$loanApp->id}", 'public');
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

        /** @var User $borrower */
        /** @var Loan $loan */
        /** @var LoanApplication $loanApp */
        [$borrower, $loan, $loanApp] = $result;

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_SUBMITTED,
            'loan_submitted',
            'Chattel mortgage application',
            'New chattel application from '.$borrower->name.' — ₱'.number_format((float) $loan->principal, 2),
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
        $this->loanMail->sendReceived(
            $borrower,
            $loan,
            'We received your Chattel Mortgage application — Amalgated Lending Inc.',
        );
    }
}
