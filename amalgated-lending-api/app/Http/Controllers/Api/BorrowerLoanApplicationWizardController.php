<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\GeneralLoanApplicationStatusMail;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Services\CreditWellnessService;
use App\Services\LoanApplicationWorkflowValidator;
use App\Services\LoanCalculator;
use App\Services\NotificationCenter;
use App\Services\SignatureStorageService;
use App\Services\TransactionalMailSender;
use App\Support\PublicStorageUrl;
use App\Support\SignedPrintUrls;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * General loan workflow (borrower): draft → documents → submit (not for travel).
 */
class BorrowerLoanApplicationWizardController extends Controller
{
    public function __construct(
        private LoanApplicationWorkflowValidator $validator,
        private SignatureStorageService $signatures,
        private LoanCalculator $calculator,
    ) {}

    public function schema(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => [
                'loan_types' => config('amalgated_loans.general_loan_types'),
                'loan_type_product_map' => $this->loanTypeProductMap(),
                'wizard_common' => config('amalgated_loans.wizard_common'),
                'loan_type_fields' => config('amalgated_loans.general_form_fields'),
                'documents_by_type' => config('amalgated_loans.general_documents'),
                'loan_products' => LoanProduct::query()
                    ->active()
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get([
                        'id',
                        'code',
                        'slug',
                        'name',
                        'status',
                        'interest_rate',
                        'rate_type',
                        'max_term',
                        'max_amount',
                        'collateral_type',
                        'requirements',
                        'age_limit',
                        'safe_age',
                        'calculator_config',
                        'rules',
                    ]),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = LoanApplication::query()
            ->where('user_id', $user->id)
            ->whereIn('loan_type', array_keys(config('amalgated_loans.general_loan_types')))
            ->with([
                'loanProduct:id,slug,code,name,interest_rate,max_term,max_amount,collateral_type,requirements',
            ])
            ->orderByDesc('id')
            ->limit(50)
            ->get()
            ->map(fn (LoanApplication $a) => $this->serializeApplication($a));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'loan_type' => 'required|string|in:'.implode(',', array_keys(config('amalgated_loans.general_loan_types'))),
        ]);

        $app = LoanApplication::create([
            'user_id' => $user->id,
            'loan_type' => $data['loan_type'],
            'status' => LoanApplication::STATUS_DRAFT,
            'form_data' => [],
            'documents' => [],
            'draft_step' => 1,
            'submitted_at' => null,
            'is_submitted' => false,
            'draft_updated_at' => now(),
        ]);
        $this->syncProductAndFinancialFieldsFromForm($app);
        $this->applyProductComputation($app);
        $app->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($app->fresh()),
        ], 201);
    }

    public function show(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication),
        ]);
    }

    public function update(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->isLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'This application cannot be edited.'], 422);
        }

        $data = $request->validate([
            'form_data' => 'nullable|array',
            'loan_type' => 'sometimes|string|in:'.implode(',', array_keys(config('amalgated_loans.general_loan_types'))),
            'draft_step' => 'sometimes|integer|min:1|max:5',
        ]);

        if (isset($data['loan_type'])) {
            $loanApplication->loan_type = $data['loan_type'];
        }
        if (array_key_exists('form_data', $data)) {
            $loanApplication->form_data = array_merge($loanApplication->form_data ?? [], $data['form_data'] ?? []);
        }
        $this->syncProductAndFinancialFieldsFromForm($loanApplication);
        if (isset($data['draft_step'])) {
            $loanApplication->draft_step = (int) $data['draft_step'];
        }
        $this->applyProductComputation($loanApplication);
        if (! $loanApplication->isOfficiallySubmitted()) {
            $loanApplication->draft_updated_at = now();
        }
        $loanApplication->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh()),
        ]);
    }

    public function uploadDocument(Request $request, LoanApplication $loanApplication, string $docKey): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->isLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Documents are locked for this application.'], 422);
        }

        $loanType = $loanApplication->loan_type;
        $defs = config('amalgated_loans.general_documents.'.$loanType, []);
        if (! isset($defs[$docKey])) {
            return response()->json(['ok' => false, 'message' => 'Invalid document key for this loan type.'], 422);
        }

        $request->validate([
            'file' => 'required|file|max:15360|mimes:jpg,jpeg,png,pdf',
        ]);

        $meta = $defs[$docKey];
        $multiple = (bool) ($meta['multiple'] ?? false);
        $file = $request->file('file');
        $dir = 'documents/'.$loanApplication->id.'/'.$docKey;
        $safe = Str::slug(pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) ?: 'upload';
        $ext = $file->getClientOriginalExtension() ?: 'bin';
        $path = $file->storeAs($dir, $safe.'-'.Str::random(6).'.'.$ext, 'public');

        $documents = $loanApplication->documents ?? [];
        if ($multiple) {
            $documents[$docKey] = array_values(array_merge((array) ($documents[$docKey] ?? []), [$path]));
        } else {
            $documents[$docKey] = $path;
        }
        $loanApplication->documents = $documents;
        if (! $loanApplication->isOfficiallySubmitted()) {
            $loanApplication->draft_updated_at = now();
        }
        $loanApplication->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh()),
        ]);
    }

    public function removeDocument(Request $request, LoanApplication $loanApplication, string $docKey): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->isLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Documents are locked.'], 422);
        }

        $request->validate([
            'path' => 'nullable|string',
        ]);
        $documents = $loanApplication->documents ?? [];
        $path = $request->input('path');

        if (! isset($documents[$docKey])) {
            return response()->json(['ok' => true, 'data' => $this->serializeApplication($loanApplication)]);
        }

        $defs = config('amalgated_loans.general_documents.'.$loanApplication->loan_type, []);
        $multiple = (bool) ($defs[$docKey]['multiple'] ?? false);

        if ($multiple && is_array($documents[$docKey])) {
            $list = array_values(array_filter($documents[$docKey], fn ($p) => $p !== $path));
            $documents[$docKey] = $list;
        } else {
            if ($documents[$docKey] === $path || $path === null) {
                unset($documents[$docKey]);
            }
        }

        if ($path && $path !== '') {
            Storage::disk('public')->delete($path);
        }

        $loanApplication->documents = $documents;
        if (! $loanApplication->isOfficiallySubmitted()) {
            $loanApplication->draft_updated_at = now();
        }
        $loanApplication->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh()),
        ]);
    }

    public function validateStep(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        $data = $request->validate([
            'step' => 'required|integer|min:1|max:4',
        ]);
        $step = (int) $data['step'];
        $errors = match ($step) {
            1 => $this->validator->validateForm($loanApplication),
            2 => $this->validator->validateDocumentsComplete($loanApplication),
            3 => $this->validator->validateBeforeSignatureStep($loanApplication),
            4 => $this->validator->validateSubmit($loanApplication),
            default => [],
        };

        return response()->json([
            'ok' => count($errors) === 0,
            'errors' => $errors,
        ]);
    }

    public function saveSignature(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->isLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Application is locked.'], 422);
        }

        $errs = $this->validator->validateBeforeSignatureStep($loanApplication);
        if ($errs !== []) {
            return response()->json(['ok' => false, 'message' => 'Complete documents before signature.', 'errors' => $errs], 422);
        }

        $data = $request->validate([
            'role' => 'required|string|in:applicant,spouse,comaker',
            'signature_base64' => 'required|string',
        ]);

        $path = $this->signatures->storeBase64Png($data['signature_base64'], 'signatures');

        match ($data['role']) {
            'applicant' => $loanApplication->applicant_signature = $path,
            'spouse' => $loanApplication->spouse_signature = $path,
            'comaker' => $loanApplication->comaker_signature = $path,
            default => null,
        };
        if (! $loanApplication->isOfficiallySubmitted()) {
            $loanApplication->draft_updated_at = now();
        }
        $loanApplication->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh()),
        ]);
    }

    public function submit(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);

        try {
            DB::transaction(function () use ($request, $loanApplication) {
                /** @var LoanApplication $locked */
                $locked = LoanApplication::query()->whereKey($loanApplication->id)->lockForUpdate()->firstOrFail();
                $this->authorizeBorrower($request, $locked);
                $this->ensureGeneralLoanApplication($locked);

                if ($locked->isOfficiallySubmitted() && $locked->status !== LoanApplication::STATUS_REJECTED) {
                    throw new HttpResponseException(response()->json(['ok' => false, 'message' => 'Already submitted.'], 422));
                }

                $errors = $this->validator->validateSubmit($locked);
                if ($errors !== []) {
                    throw new HttpResponseException(response()->json(['ok' => false, 'errors' => $errors], 422));
                }

                $locked->status = LoanApplication::STATUS_PENDING;
                $locked->rejection_reason = null;
                $locked->submitted_at = now();
                $locked->is_submitted = true;
                $locked->draft_step = 5;
                $locked->save();

                $linkedLoan = $locked->loan;
                $payload = $this->buildLoanPayloadFromApplication($locked);
                $annualRate = $this->resolveLoanAnnualRateFromApplication($locked);

                if ($linkedLoan) {
                    $linkedLoan->borrower_id = $locked->user_id;
                    $linkedLoan->principal = (float) ($locked->loan_amount ?? 0);
                    $linkedLoan->requested_principal = round((float) ($locked->loan_amount ?? 0), 2);
                    $linkedLoan->term_months = max(1, (int) ($locked->term_months ?? 1));
                    $linkedLoan->annual_interest_rate = $annualRate;
                    $linkedLoan->status = Loan::STATUS_PENDING;
                    $linkedLoan->rejection_reason = null;
                    $linkedLoan->application_payload = $payload;
                    $linkedLoan->save();
                } else {
                    $loan = Loan::create([
                        'borrower_id' => $locked->user_id,
                        'principal' => (float) ($locked->loan_amount ?? 0),
                        'requested_principal' => round((float) ($locked->loan_amount ?? 0), 2),
                        'term_months' => max(1, (int) ($locked->term_months ?? 1)),
                        'annual_interest_rate' => $annualRate,
                        'status' => Loan::STATUS_PENDING,
                        'application_payload' => $payload,
                    ]);
                    $locked->loan_id = $loan->id;
                    $locked->save();
                }

                if ($locked->loan_id) {
                    app(NotificationCenter::class)->notifyStaff(
                        NotificationCenter::CATEGORY_LOAN_SUBMITTED,
                        'loan_submitted',
                        'New borrower portal application',
                        'Application #'.$locked->id.' was submitted and is pending approval.',
                        [
                            'loan_id' => $locked->loan_id,
                            'loan_application_id' => $locked->id,
                            'source' => 'borrower_portal',
                        ],
                        null,
                        ['module' => NotificationCenter::MODULE_LOANS],
                    );
                }
            });
        } catch (HttpResponseException $e) {
            return $e->getResponse();
        }

        $fresh = $loanApplication->fresh(['borrower']);
        if ($fresh->borrower) {
            app(NotificationCenter::class)->notifyBorrower(
                $fresh->borrower,
                NotificationCenter::CATEGORY_LOAN_SUBMITTED,
                'application_submitted',
                'Application submitted',
                'We received your application #'.$fresh->id.' and will review it shortly.',
                ['loan_application_id' => $fresh->id, 'loan_id' => $fresh->loan_id],
                ['dedupe_key' => 'wizard_submit:'.$fresh->id, 'module' => NotificationCenter::MODULE_LOANS],
            );
        }
        $this->notifyBorrowerApplicationStatus($fresh, LoanApplication::STATUS_PENDING);

        $borrower = $request->user();
        $eligibility = app(CreditWellnessService::class)->eligibilityImpactForUser($borrower);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh()),
            'credit_wellness' => $eligibility,
            'message' => $eligibility['requires_manual_approval'] ?? false
                ? 'Application submitted. Additional review may be required based on your credit wellness profile.'
                : 'Application submitted. Our team will review it shortly.',
        ]);
    }

    /**
     * Remove an in-progress general loan wizard application (draft only).
     */
    public function destroy(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);

        if ($loanApplication->isOfficiallySubmitted()) {
            return response()->json([
                'ok' => false,
                'message' => 'Submitted applications cannot be deleted. Contact support if you need to withdraw an application.',
            ], 422);
        }

        if ($loanApplication->loan_id !== null) {
            return response()->json([
                'ok' => false,
                'message' => 'This application is linked to a loan record and cannot be deleted here.',
            ], 422);
        }

        DB::transaction(function () use ($loanApplication) {
            $this->purgeGeneralWizardStoredFiles($loanApplication);
            $loanApplication->delete();
        });

        return response()->json(['ok' => true, 'message' => 'Draft application deleted.']);
    }

    private function ensureGeneralLoanApplication(LoanApplication $loanApplication): void
    {
        if (! in_array($loanApplication->loan_type, array_keys(config('amalgated_loans.general_loan_types')), true)) {
            abort(404);
        }
    }

    private function isLockedForBorrower(LoanApplication $loanApplication): bool
    {
        if (! $loanApplication->isOfficiallySubmitted()) {
            return false;
        }

        return $loanApplication->status !== LoanApplication::STATUS_REJECTED;
    }

    private function authorizeBorrower(Request $request, LoanApplication $loanApplication): void
    {
        $user = $request->user();
        if (! $user || (int) $loanApplication->user_id !== (int) $user->id) {
            abort(403);
        }
    }

    private function purgeGeneralWizardStoredFiles(LoanApplication $app): void
    {
        $disk = Storage::disk('public');
        foreach ($app->documents ?? [] as $paths) {
            if (is_array($paths)) {
                foreach ($paths as $p) {
                    if (is_string($p) && $p !== '') {
                        $disk->delete($p);
                    }
                }
            } elseif (is_string($paths) && $paths !== '') {
                $disk->delete($paths);
            }
        }
        foreach (['applicant_signature', 'spouse_signature', 'comaker_signature'] as $attr) {
            $p = $app->{$attr};
            if (is_string($p) && $p !== '') {
                $disk->delete($p);
            }
        }
    }

    private function notifyBorrowerApplicationStatus(LoanApplication $loanApplication, string $status): void
    {
        $borrower = $loanApplication->borrower;
        if (! $borrower) {
            return;
        }

        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new GeneralLoanApplicationStatusMail($loanApplication, (string) $borrower->name, $status);
        $subject = match ($status) {
            LoanApplication::STATUS_APPROVED => 'Loan application update: approved — Amalgated Lending Inc.',
            LoanApplication::STATUS_REJECTED => 'Loan application update: rejected — Amalgated Lending Inc.',
            default => 'Loan application submitted — Amalgated Lending Inc.',
        };

        app(TransactionalMailSender::class)->sendHtmlMailable(
            $mailable,
            $email,
            (string) $borrower->name,
            $subject,
            [
                'purpose' => 'general_loan_application_status',
                'loan_application_id' => $loanApplication->id,
                'status' => $status,
            ],
        );
    }

    private function serializeApplication(LoanApplication $a): array
    {
        $docs = [];
        foreach ($a->documents ?? [] as $key => $paths) {
            $urls = [];
            if (is_array($paths)) {
                foreach ($paths as $p) {
                    if ($p) {
                        $urls[] = PublicStorageUrl::apiUrl($p);
                    }
                }
            } elseif ($paths) {
                $urls[] = PublicStorageUrl::apiUrl($paths);
            }
            $docs[$key] = ['paths' => is_array($paths) ? $paths : ($paths ? [$paths] : []), 'urls' => $urls];
        }

        $label = config('amalgated_loans.general_loan_types')[$a->loan_type] ?? $a->loan_type;

        return [
            'id' => $a->id,
            'loan_type' => $a->loan_type,
            'loan_type_label' => $label,
            'status' => $a->status,
            'loan_product_id' => $a->loan_product_id,
            'loan_product' => $a->loanProduct ? [
                'id' => $a->loanProduct->id,
                'slug' => $a->loanProduct->slug,
                'code' => $a->loanProduct->code,
                'name' => $a->loanProduct->name,
                'interest_rate' => $a->loanProduct->interest_rate,
                'max_term' => $a->loanProduct->max_term,
                'max_amount' => $a->loanProduct->max_amount,
                'collateral_type' => $a->loanProduct->collateral_type,
                'requirements' => $a->loanProduct->requirements,
            ] : null,
            'loan_amount' => $a->loan_amount !== null ? (float) $a->loan_amount : null,
            'approved_amount' => $a->approved_amount !== null ? (float) $a->approved_amount : null,
            'term_months' => $a->term_months !== null ? (int) $a->term_months : null,
            'computed_values' => $a->computed_values,
            'computation_breakdown' => $a->computation_breakdown,
            'form_data' => $a->form_data ?? [],
            'documents' => $docs,
            'draft_step' => $a->draft_step,
            'draft_updated_at' => $a->draft_updated_at?->toIso8601String(),
            'is_submitted' => (bool) $a->is_submitted,
            'submitted_at' => $a->submitted_at?->toIso8601String(),
            'verified_at' => $a->verified_at?->toIso8601String(),
            'rejection_reason' => $a->rejection_reason,
            'signatures' => [
                'applicant' => $a->applicant_signature ? PublicStorageUrl::apiUrl($a->applicant_signature) : null,
                'spouse' => $a->spouse_signature ? PublicStorageUrl::apiUrl($a->spouse_signature) : null,
                'comaker' => $a->comaker_signature ? PublicStorageUrl::apiUrl($a->comaker_signature) : null,
            ],
            'applicant_signature_path' => $a->applicant_signature,
            'spouse_signature_path' => $a->spouse_signature,
            'comaker_signature_path' => $a->comaker_signature,
            'is_draft' => ! $a->isOfficiallySubmitted(),
            'print_url' => SignedPrintUrls::temporaryRoute(
                'print.general-loan',
                now()->addMinutes(45),
                ['loanApplication' => $a->id]
            ),
        ];
    }

    private function loanTypeProductMap(): array
    {
        return [
            LoanApplication::TYPE_REAL_ESTATE => 'real-estate-mortgage',
            LoanApplication::TYPE_CHATTEL => 'chattel-mortgage',
            LoanApplication::TYPE_SALARY => 'salary-loan',
            LoanApplication::TYPE_TRAVEL_ASSISTANCE => 'travel-assistance-loan',
            LoanApplication::TYPE_SSS_PENSION => 'sss-pension-loan',
        ];
    }

    private function syncProductAndFinancialFieldsFromForm(LoanApplication $app): void
    {
        $form = is_array($app->form_data) ? $app->form_data : [];
        $loanProductId = isset($form['loan_product_id']) ? (int) $form['loan_product_id'] : 0;

        if ($loanProductId > 0) {
            $app->loan_product_id = $loanProductId;
        } elseif (! $app->loan_product_id) {
            $slug = $this->loanTypeProductMap()[$app->loan_type] ?? null;
            if (is_string($slug)) {
                $fallback = LoanProduct::query()->where('slug', $slug)->first();
                if ($fallback) {
                    $app->loan_product_id = $fallback->id;
                    $form['loan_product_id'] = $fallback->id;
                    $app->form_data = $form;
                }
            }
        }

        if (array_key_exists('loan_amount', $form) && $form['loan_amount'] !== '' && $form['loan_amount'] !== null) {
            $app->loan_amount = (float) $form['loan_amount'];
        }
        if (array_key_exists('term_months', $form) && $form['term_months'] !== '' && $form['term_months'] !== null) {
            $app->term_months = max(1, (int) $form['term_months']);
        }
    }

    private function applyProductComputation(LoanApplication $app): void
    {
        if (! $app->loan_product_id || ! $app->loan_amount || $app->loan_amount <= 0) {
            return;
        }

        $form = is_array($app->form_data) ? $app->form_data : [];
        $nature = (string) ($form['application_nature'] ?? 'new');
        $payload = [
            'product_id' => (int) $app->loan_product_id,
            'loan_amount' => (float) $app->loan_amount,
            'term_months' => (int) ($app->term_months ?? 1),
            'application_nature' => $nature,
            'age' => isset($form['age']) && $form['age'] !== '' ? (int) $form['age'] : null,
            'monthly_pension' => isset($form['monthly_pension']) && $form['monthly_pension'] !== ''
                ? (float) $form['monthly_pension']
                : null,
            'pension_type' => isset($form['pension_type']) && $form['pension_type'] !== ''
                ? (string) $form['pension_type']
                : null,
        ];

        try {
            $compute = $this->calculator->compute($payload);
            $app->computed_values = [
                'monthly_rate_percent_effective' => $compute['product']['monthly_rate_percent_effective'] ?? null,
                'monthly_amortization' => $compute['breakdown']['monthly_amortization'] ?? null,
                'net_proceeds' => $compute['breakdown']['net_proceeds'] ?? null,
            ];
            $app->computation_breakdown = $compute;
        } catch (ValidationException $e) {
            $app->computed_values = [
                'validation_errors' => $e->errors(),
            ];
            $app->computation_breakdown = null;
        }
    }

    private function resolveLoanAnnualRateFromApplication(LoanApplication $app): float
    {
        $breakdown = is_array($app->computation_breakdown) ? $app->computation_breakdown : [];
        $monthly = data_get($breakdown, 'product.monthly_rate_percent_effective');
        if (is_numeric($monthly) && (float) $monthly > 0) {
            return round(((float) $monthly) * 12, 4);
        }

        if ($app->loanProduct) {
            $rate = (float) ($app->loanProduct->interest_rate ?? 0);
            if ($rate > 0) {
                $rateType = strtolower((string) ($app->loanProduct->rate_type ?? 'monthly'));

                return $rateType === 'monthly' ? round($rate * 12, 4) : round($rate, 4);
            }
        }

        return 12.0;
    }

    private function buildLoanPayloadFromApplication(LoanApplication $app): array
    {
        $form = is_array($app->form_data) ? $app->form_data : [];
        $computed = is_array($app->computed_values) ? $app->computed_values : [];
        $productSlug = $app->loanProduct?->slug ?? ($this->loanTypeProductMap()[$app->loan_type] ?? null);

        return array_filter([
            'source' => 'borrower_wizard_general',
            'loan_application_id' => $app->id,
            'loan_product_id' => $app->loan_product_id,
            'loan_product_slug' => $productSlug,
            'selected_interest_rate' => is_numeric($computed['monthly_rate_percent_effective'] ?? null)
                ? (float) $computed['monthly_rate_percent_effective']
                : null,
            'selected_rate_type' => 'monthly',
            'loan_type' => $app->loan_type,
            'application_nature' => $form['application_nature'] ?? 'new',
            'full_name' => $form['full_name'] ?? null,
            'email' => $form['email'] ?? null,
            'phone' => $form['phone'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }
}
