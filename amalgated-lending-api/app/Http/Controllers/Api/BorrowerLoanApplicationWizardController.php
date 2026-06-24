<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\GeneralLoanApplicationStatusMail;
use App\Models\ChattelMortgageDetail;
use App\Models\CoMaker;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Models\LoanProduct;
use App\Models\PensionLoanDetail;
use App\Models\RealEstateDetail;
use App\Models\SalaryLoanDetail;
use App\Models\TravelAssistanceDetail;
use App\Services\CoMakerRequirementService;
use App\Services\CreditWellnessService;
use App\Services\LoanApplicationWorkflowValidator;
use App\Services\LoanCalculator;
use App\Services\LoanProductDocumentRequirementsService;
use App\Services\NotificationCenter;
use App\Services\SignatureStorageService;
use App\Services\TransactionalMailSender;
use App\Support\PublicStorageUrl;
use App\Support\SignedPrintUrls;
use InvalidArgumentException;
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
        private PensionLoanCapacityService $pensionCapacity,
        private LoanProductDocumentRequirementsService $documentRequirements,
    ) {}

    public function schema(): JsonResponse
    {
        $documentsByType = config('amalgated_loans.general_documents');
        $travelDocs = $documentsByType['travel_assistance'] ?? [];
        if (is_array($travelDocs)) {
            $documentsByType['travel_assistance'] = $this->documentRequirements->normalizeDefinitions(
                array_filter(
                    $travelDocs,
                    fn (array $meta) => ($meta['borrower_visible'] ?? true) !== false,
                ),
            );
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'loan_types' => config('amalgated_loans.general_loan_types'),
                'loan_application_routes' => config('amalgated_loans.loan_application_routes'),
                'product_application_steps' => config('amalgated_loans.product_application_steps'),
                'product_application_fields' => config('amalgated_loans.product_application_fields'),
                'loan_type_product_map' => $this->loanTypeProductMap(),
                'wizard_common' => config('amalgated_loans.wizard_common'),
                'loan_type_fields' => config('amalgated_loans.general_form_fields'),
                'documents_by_type' => $documentsByType,
                'travel_assistance_documents_by_purpose' => config('amalgated_loans.travel_assistance_documents_by_purpose'),
                'loan_types_requiring_co_makers' => config('amalgated_loans.loan_types_requiring_co_makers'),
                'co_maker_document_categories' => CoMakerRequirementService::documentCategories(),
                'co_maker_schema' => [
                    'relationship_options' => config('co_maker.relationship_options'),
                    'employment_status_options' => config('co_maker.employment_status_options'),
                    'gender_options' => config('co_maker.gender_options'),
                    'civil_status_options' => config('co_maker.civil_status_options'),
                    'valid_id_types' => config('co_maker.valid_id_types'),
                    'max_upload_mb' => config('co_maker.max_upload_mb'),
                ],
                'real_estate_property_step_documents' => config('amalgated_loans.real_estate_property_step_documents'),
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
        $this->syncSpecificLoanDetails($app);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($app->fresh()),
        ], 201);
    }

    public function show(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        $loanApplication->loadMissing(['coMakers.documents']);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication),
        ]);
    }

    public function update(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->isFormLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'This application cannot be edited.'], 422);
        }

        $data = $request->validate([
            'form_data' => 'nullable|array',
            'loan_type' => 'sometimes|string|in:'.implode(',', array_keys(config('amalgated_loans.general_loan_types'))),
            'draft_step' => 'sometimes|integer|min:1|max:8',
        ]);

        if (isset($data['loan_type'])) {
            $loanApplication->loan_type = $data['loan_type'];
        }
        if (array_key_exists('form_data', $data)) {
            $merged = array_merge($loanApplication->form_data ?? [], $data['form_data'] ?? []);
            $loanApplication->form_data = $this->stripStaffOnlyFormKeys($loanApplication, $merged);
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
        $this->syncSpecificLoanDetails($loanApplication);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh(['coMakers.documents'])),
        ]);
    }

    public function uploadDocument(Request $request, LoanApplication $loanApplication, string $docKey): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->areDocumentsLockedForBorrower($loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Documents are locked for this application.'], 422);
        }

        $loanType = $loanApplication->loan_type;
        $loanApplication->loadMissing('loanProduct');
        $defs = $this->documentRequirements->definitionsForApplication($loanApplication);
        if (! isset($defs[$docKey])) {
            return response()->json(['ok' => false, 'message' => 'Invalid document key for this loan type.'], 422);
        }

        $request->validate([
            'file' => 'required|file|max:20480|mimes:jpg,jpeg,png,pdf',
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
            'data' => $this->serializeApplication($loanApplication->fresh(['coMakers.documents'])),
        ]);
    }

    public function removeDocument(Request $request, LoanApplication $loanApplication, string $docKey): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        if ($this->areDocumentsLockedForBorrower($loanApplication)) {
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

        $loanApplication->loadMissing('loanProduct');
        $defs = $this->documentRequirements->definitionsForApplication($loanApplication);
        $multiple = (bool) ($defs[$docKey]['multiple'] ?? false);

        $removedPaths = [];

        if ($multiple && is_array($documents[$docKey])) {
            if ($path === null || $path === '') {
                return response()->json(['ok' => false, 'message' => 'Document path is required.'], 422);
            }

            $existing = array_values(array_filter($documents[$docKey], fn ($p) => is_string($p) && $p !== ''));
            if (! in_array($path, $existing, true)) {
                return response()->json(['ok' => false, 'message' => 'Document path is not attached to this application.'], 422);
            }

            $documents[$docKey] = array_values(array_filter($existing, fn ($p) => $p !== $path));
            $removedPaths[] = $path;
        } else {
            $currentPath = is_string($documents[$docKey]) ? $documents[$docKey] : null;
            if ($currentPath === null || ($path !== null && $path !== $currentPath)) {
                return response()->json(['ok' => false, 'message' => 'Document path is not attached to this application.'], 422);
            }

            unset($documents[$docKey]);
            $removedPaths[] = $currentPath;
        }

        $deletablePrefix = 'documents/'.$loanApplication->id.'/'.$docKey.'/';
        $removedPaths = array_values(array_filter(
            $removedPaths,
            fn ($p) => is_string($p) && str_starts_with($p, $deletablePrefix)
        ));
        if ($removedPaths !== []) {
            Storage::disk('public')->delete($removedPaths);
        }

        $loanApplication->documents = $documents;
        if (! $loanApplication->isOfficiallySubmitted()) {
            $loanApplication->draft_updated_at = now();
        }
        $loanApplication->save();

        return response()->json([
            'ok' => true,
            'data' => $this->serializeApplication($loanApplication->fresh(['coMakers.documents'])),
        ]);
    }

    public function validateStep(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureGeneralLoanApplication($loanApplication);
        $data = $request->validate([
            'step' => 'required|integer|min:1|max:8',
        ]);
        $step = (int) $data['step'];
        $stepConfig = collect(config('amalgated_loans.product_application_steps.'.$loanApplication->loan_type, []))->firstWhere('id', $step);
        $section = is_array($stepConfig) ? ($stepConfig['section'] ?? null) : null;
        $errors = match ($section) {
            'co_makers' => $this->validator->validateCoMakers($loanApplication->loadMissing('coMakers.documents')),
            'documents' => $this->validator->validateDocumentsComplete($loanApplication),
            'review' => $this->validator->validateSubmit($loanApplication->loadMissing('coMakers.documents')),
            default => $this->validator->validateFormStep($loanApplication, $step),
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

        try {
            $path = $this->signatures->storeBase64Png($data['signature_base64'], 'signatures');
        } catch (InvalidArgumentException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 422);
        }

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
            'data' => $this->serializeApplication($loanApplication->fresh(['coMakers.documents'])),
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
                $this->syncSpecificLoanDetails($locked);

                $linkedLoan = $locked->loan;
                $payload = $this->buildLoanPayloadFromApplication($locked);
                $annualRate = $this->resolveLoanAnnualRateFromApplication($locked);

                if ($linkedLoan) {
                    $linkedLoan->borrower_id = $locked->user_id;
                    $linkedLoan->principal = 0;
                    $linkedLoan->requested_principal = $this->legacyRequestedPrincipal($locked);
                    $linkedLoan->term_months = max(1, (int) ($locked->term_months ?? 1));
                    $linkedLoan->annual_interest_rate = $annualRate;
                    $linkedLoan->status = Loan::STATUS_PENDING;
                    $linkedLoan->rejection_reason = null;
                    $linkedLoan->application_payload = $payload;
                    $linkedLoan->save();
                } else {
                    $loan = Loan::create([
                        'borrower_id' => $locked->user_id,
                        'principal' => 0,
                        'requested_principal' => $this->legacyRequestedPrincipal($locked),
                        'term_months' => max(1, (int) ($locked->term_months ?? 1)),
                        'annual_interest_rate' => $annualRate,
                        'status' => Loan::STATUS_PENDING,
                        'application_payload' => $payload,
                    ]);
                    $locked->loan_id = $loan->id;
                    $locked->save();
                }

                if ($locked->loan_id) {
                    $locked->coMakers()->update(['loan_id' => $locked->loan_id]);
                    LoanDocument::query()
                        ->where('loan_application_id', $locked->id)
                        ->update(['loan_id' => $locked->loan_id]);

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
        app(CreditWellnessService::class)->recalculateForUser($borrower, notify: false);
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

    private function isFormLockedForBorrower(LoanApplication $loanApplication): bool
    {
        if (! $loanApplication->isOfficiallySubmitted()) {
            return false;
        }

        return $loanApplication->status !== LoanApplication::STATUS_REJECTED;
    }

    private function areDocumentsLockedForBorrower(LoanApplication $loanApplication): bool
    {
        return in_array($loanApplication->status, [
            LoanApplication::STATUS_REJECTED,
            LoanApplication::STATUS_APPROVED,
        ], true);
    }

    /**
     * @param  array<string, mixed>  $form
     * @return array<string, mixed>
     */
    private function stripStaffOnlyFormKeys(LoanApplication $app, array $form): array
    {
        foreach ([
            'loan_amount',
            'requested_loan_amount',
            'prospected_loan_amount',
        ] as $key) {
            unset($form[$key]);
        }

        if ($app->loan_type !== LoanApplication::TYPE_REAL_ESTATE) {
            return $form;
        }

        foreach ([
            'lot_area',
            'floor_area',
            'market_value',
            'assessed_value',
            'appraised_value',
            'loanable_percentage',
            'loanable_value',
            'evaluation_remarks',
        ] as $key) {
            unset($form[$key]);
        }

        return $form;
    }

    private function isLockedForBorrower(LoanApplication $loanApplication): bool
    {
        return $this->isFormLockedForBorrower($loanApplication);
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
        $a->loadMissing(['coMakers.documents']);
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
            'evaluation' => $this->serializeBorrowerEvaluation($a),
            'term_months' => $a->term_months !== null ? (int) $a->term_months : null,
            'computed_values' => $a->computed_values,
            'computation_breakdown' => $a->computation_breakdown,
            'form_data' => $a->form_data ?? [],
            'specific_details' => $this->serializeSpecificDetails($a),
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
            'co_makers' => $a->coMakers->map(function ($cm) {
                $docsByCategory = [];
                foreach (CoMaker::DOCUMENT_CATEGORIES as $cat) {
                    $docsByCategory[$cat] = [];
                }
                foreach ($cm->documents as $doc) {
                    $cat = $doc->document_category ?? 'other_attachments';
                    if (! isset($docsByCategory[$cat])) {
                        $docsByCategory[$cat] = [];
                    }
                    $docsByCategory[$cat][] = [
                        'id' => $doc->id,
                        'original_name' => $doc->original_name,
                        'file_url' => $doc->file_path ? PublicStorageUrl::apiUrl($doc->file_path) : null,
                        'file_path' => $doc->file_path,
                        'verification_status' => $doc->verification_status,
                    ];
                }

                return [
                    'id' => $cm->id,
                    'first_name' => $cm->first_name,
                    'middle_name' => $cm->middle_name,
                    'last_name' => $cm->last_name,
                    'suffix' => $cm->suffix,
                    'full_name' => $cm->displayName(),
                    'date_of_birth' => $cm->date_of_birth?->format('Y-m-d'),
                    'age' => $cm->age,
                    'gender' => $cm->gender,
                    'civil_status' => $cm->civil_status,
                    'contact_number' => $cm->contact_number,
                    'alternate_contact_number' => $cm->alternate_contact_number,
                    'email' => $cm->email,
                    'house_street' => $cm->house_street,
                    'relationship_to_borrower' => $cm->relationship_to_borrower,
                    'employment_status' => $cm->employment_status,
                    'occupation' => $cm->occupation,
                    'employer_business_name' => $cm->employer_business_name,
                    'length_of_employment' => $cm->length_of_employment,
                    'monthly_income' => $cm->monthly_income !== null ? (float) $cm->monthly_income : null,
                    'other_income_source' => $cm->other_income_source,
                    'complete_address' => $cm->complete_address ?? $cm->address,
                    'province' => $cm->province,
                    'city_municipality' => $cm->city_municipality,
                    'barangay' => $cm->barangay,
                    'postal_code' => $cm->postal_code,
                    'valid_id_type' => $cm->valid_id_type,
                    'valid_id_number' => $cm->valid_id_number,
                    'verification_status' => $cm->verification_status ?? CoMaker::VERIFY_PENDING,
                    'review_notes' => $cm->review_notes,
                    'documents_by_category' => $docsByCategory,
                ];
            })->values(),
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

        if (array_key_exists('term_months', $form) && $form['term_months'] !== '' && $form['term_months'] !== null) {
            $app->term_months = max(1, (int) $form['term_months']);
        }

        if ($app->loan_type === LoanApplication::TYPE_REAL_ESTATE && ! empty($form['property_address'])) {
            $app->property_location = trim((string) $form['property_address']);
        }

        if ($app->loan_type === LoanApplication::TYPE_TRAVEL_ASSISTANCE && ! $app->isOfficiallySubmitted()) {
            $app->loan_amount = null;
        }
    }

    private function syncSpecificLoanDetails(LoanApplication $app): void
    {
        $form = is_array($app->form_data) ? $app->form_data : [];

        match ($app->loan_type) {
            LoanApplication::TYPE_SALARY => SalaryLoanDetail::updateOrCreate(
                ['loan_application_id' => $app->id],
                $this->onlyFormKeys($form, [
                    'full_name',
                    'birthdate',
                    'civil_status',
                    'address',
                    'phone',
                    'employer_name',
                    'company_address',
                    'position',
                    'employment_type',
                    'years_of_service',
                    'monthly_gross_salary',
                    'monthly_net_salary',
                    'other_income',
                    'loan_purpose',
                ])
            ),
            LoanApplication::TYPE_CHATTEL => ChattelMortgageDetail::updateOrCreate(
                ['loan_application_id' => $app->id],
                $this->onlyFormKeys($form, [
                    'full_name',
                    'birthdate',
                    'civil_status',
                    'address',
                    'phone',
                    'vehicle_type',
                    'brand',
                    'model',
                    'year_model',
                    'plate_number',
                    'engine_number',
                    'chassis_number',
                    'or_number',
                    'cr_number',
                    'market_value',
                    'loan_purpose',
                ])
            ),
            LoanApplication::TYPE_REAL_ESTATE => RealEstateDetail::updateOrCreate(
                ['loan_application_id' => $app->id],
                $this->onlyFormKeys($form, [
                    'full_name',
                    'birthdate',
                    'civil_status',
                    'address',
                    'phone',
                    'property_type',
                    'title_number',
                    'tax_declaration_number',
                    'property_address',
                    'property_description',
                    'loan_purpose',
                ])
            ),
            LoanApplication::TYPE_SSS_PENSION => PensionLoanDetail::updateOrCreate(
                ['loan_application_id' => $app->id],
                $this->onlyFormKeys($form, [
                    'full_name',
                    'birthdate',
                    'civil_status',
                    'address',
                    'phone',
                    'pension_type',
                    'sss_number',
                    'gsis_bp_number',
                    'monthly_pension',
                    'pension_start_date',
                    'bank_account_number',
                    'loan_purpose',
                ])
            ),
            LoanApplication::TYPE_TRAVEL_ASSISTANCE => TravelAssistanceDetail::updateOrCreate(
                ['application_id' => $app->id],
                [
                    'travel_purpose' => $this->nullableFormValue($form, 'travel_purpose'),
                    'destination_country' => $this->nullableFormValue($form, 'destination_country'),
                    'destination_city' => $this->nullableFormValue($form, 'destination_city'),
                    'departure_date' => $this->nullableFormValue($form, 'departure_date'),
                    'return_date' => $this->nullableFormValue($form, 'return_date'),
                    'visa_status' => $this->nullableFormValue($form, 'visa_status'),
                    'agency_name' => $this->nullableFormValue($form, 'agency_name'),
                    'employer_name' => $this->nullableFormValue($form, 'employer_name'),
                    'travel_cost' => $this->numberOrNull($form, 'travel_cost'),
                    'airfare_cost' => $this->numberOrNull($form, 'airfare_cost'),
                    'visa_cost' => $this->numberOrNull($form, 'visa_cost'),
                    'medical_cost' => $this->numberOrNull($form, 'medical_cost'),
                    'placement_fee' => $this->numberOrNull($form, 'placement_fee'),
                    'other_expenses' => $this->numberOrNull($form, 'other_expenses'),
                ]
            ),
            default => null,
        };
    }

    private function onlyFormKeys(array $form, array $keys): array
    {
        $out = [];
        foreach ($keys as $key) {
            $value = $form[$key] ?? null;
            $out[$key] = $value === '' ? null : $value;
        }

        return $out;
    }

    private function nullableFormValue(array $form, string $key): mixed
    {
        $value = $form[$key] ?? null;

        return $value === '' ? null : $value;
    }

    private function numberOrNull(array $form, string $key): ?float
    {
        $value = $this->nullableFormValue($form, $key);

        return is_numeric($value) ? (float) $value : null;
    }

    private function serializeSpecificDetails(LoanApplication $app): ?array
    {
        $model = match ($app->loan_type) {
            LoanApplication::TYPE_SALARY => SalaryLoanDetail::query()->where('loan_application_id', $app->id)->first(),
            LoanApplication::TYPE_CHATTEL => ChattelMortgageDetail::query()->where('loan_application_id', $app->id)->first(),
            LoanApplication::TYPE_REAL_ESTATE => RealEstateDetail::query()->where('loan_application_id', $app->id)->first(),
            LoanApplication::TYPE_SSS_PENSION => PensionLoanDetail::query()->where('loan_application_id', $app->id)->first(),
            LoanApplication::TYPE_TRAVEL_ASSISTANCE => TravelAssistanceDetail::query()->where('application_id', $app->id)->first(),
            default => null,
        };

        if (! $model) {
            return null;
        }

        $hidden = ['id', 'loan_application_id', 'application_id', 'created_at', 'updated_at'];
        if ($app->loan_type === LoanApplication::TYPE_REAL_ESTATE) {
            $hidden = array_merge($hidden, [
                'lot_area',
                'floor_area',
                'market_value',
                'assessed_value',
                'appraised_value',
                'loanable_percentage',
                'loanable_value',
                'evaluation_remarks',
                'evaluated_by',
                'evaluated_at',
            ]);
        }

        return collect($model->toArray())->except($hidden)->all();
    }

    private function applyProductComputation(LoanApplication $app): void
    {
        if (! $app->loan_product_id) {
            return;
        }

        $form = is_array($app->form_data) ? $app->form_data : [];
        $nature = (string) ($form['application_nature'] ?? 'new');
        $termMonths = (int) ($app->term_months ?? $form['term_months'] ?? 0);
        if ($termMonths <= 0) {
            return;
        }

        $loanAmount = (float) ($app->loan_amount ?? 0);
        if ($app->loan_type === LoanApplication::TYPE_SSS_PENSION) {
            $monthlyPension = isset($form['monthly_pension']) && $form['monthly_pension'] !== ''
                ? (float) $form['monthly_pension']
                : 0.0;
            if ($monthlyPension <= 0) {
                $app->computed_values = null;
                $app->computation_breakdown = null;

                return;
            }

            $product = $app->loanProduct ?? LoanProduct::query()->find($app->loan_product_id);
            if (! $product) {
                return;
            }

            $estimate = $this->pensionCapacity->estimateFromPension($product, [
                'monthly_pension' => $monthlyPension,
                'term_months' => $termMonths,
                'application_nature' => $nature,
                'pension_type' => $form['pension_type'] ?? null,
            ]);
            $loanAmount = (float) ($estimate['estimated_loanable_amount'] ?? 0);
            if ($loanAmount <= 0) {
                $app->computed_values = [
                    'pension_preview' => $estimate,
                    'validation_errors' => $estimate['validation_errors'] ?? [],
                ];
                $app->computation_breakdown = null;

                return;
            }
        } elseif ($app->loan_type === LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            $quoted = isset($form['travel_cost']) && $form['travel_cost'] !== ''
                ? (float) $form['travel_cost']
                : 0.0;
            if ($quoted <= 0) {
                $app->computed_values = null;
                $app->computation_breakdown = null;

                return;
            }
            $loanAmount = $quoted;
        } elseif ($loanAmount <= 0) {
            return;
        }

        $payload = [
            'product_id' => (int) $app->loan_product_id,
            'loan_amount' => $loanAmount,
            'term_months' => $termMonths,
            'application_nature' => $nature,
            'age' => isset($form['age']) && $form['age'] !== '' ? (int) $form['age'] : null,
            'monthly_pension' => isset($form['monthly_pension']) && $form['monthly_pension'] !== ''
                ? (float) $form['monthly_pension']
                : null,
            'pension_type' => isset($form['pension_type']) && $form['pension_type'] !== ''
                ? (string) $form['pension_type']
                : null,
            'skip_borrower_amount_caps' => $app->loan_type === LoanApplication::TYPE_TRAVEL_ASSISTANCE,
        ];

        try {
            $compute = $this->calculator->compute($payload);
            $app->computed_values = [
                'monthly_rate_percent_effective' => $compute['product']['monthly_rate_percent_effective'] ?? null,
                'monthly_amortization' => $compute['breakdown']['monthly_amortization'] ?? null,
                'net_proceeds' => $compute['breakdown']['net_proceeds'] ?? null,
                'estimated_loanable_amount' => $loanAmount,
                'quoted_travel_cost' => $app->loan_type === LoanApplication::TYPE_TRAVEL_ASSISTANCE ? $loanAmount : null,
                'remaining_pension' => $compute['breakdown']['remaining_pension'] ?? null,
                'pension_compliance_ok' => $compute['breakdown']['pension_compliance_ok'] ?? null,
            ];
            $app->computation_breakdown = $compute;
            if ($app->loan_type === LoanApplication::TYPE_SSS_PENSION && $loanAmount > 0) {
                $app->loan_amount = round($loanAmount, 2);
            }
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
            'monthly_pension' => isset($form['monthly_pension']) ? (float) $form['monthly_pension'] : null,
            'pension_type' => $form['pension_type'] ?? null,
            'estimated_loanable_amount' => is_numeric($computed['estimated_loanable_amount'] ?? null)
                ? (float) $computed['estimated_loanable_amount']
                : null,
            'full_name' => $form['full_name'] ?? null,
            'email' => $form['email'] ?? null,
            'phone' => $form['phone'] ?? null,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * Preserve borrower-entered amounts on legacy applications only.
     */
    private function legacyRequestedPrincipal(LoanApplication $app): ?float
    {
        $amount = $app->loan_amount;
        if ($amount === null || (float) $amount <= 0) {
            return null;
        }

        return round((float) $amount, 2);
    }

    /**
     * Read-only evaluation summary for borrower portal views.
     *
     * @return array<string, mixed>
     */
    private function serializeBorrowerEvaluation(LoanApplication $app): array
    {
        $app->loadMissing(['loan']);
        $loan = $app->loan;

        $approved = null;
        if ($loan?->approved_principal !== null && (float) $loan->approved_principal > 0) {
            $approved = round((float) $loan->approved_principal, 2);
        } elseif ($app->approved_amount !== null && (float) $app->approved_amount > 0) {
            $approved = round((float) $app->approved_amount, 2);
        }

        $approvalStatus = (string) ($loan?->status ?? $app->status);
        $remarks = trim((string) ($loan?->approval_notes ?? ''));
        $evaluated = $approved !== null && $approved > 0;

        return [
            'status' => $evaluated ? 'evaluated' : 'pending',
            'approval_status' => $approvalStatus,
            'approved_loan_amount' => $approved,
            'evaluation_remarks' => $remarks !== '' ? $remarks : null,
            'evaluated_at' => $loan?->amount_modified_at?->toIso8601String(),
        ];
    }
}
