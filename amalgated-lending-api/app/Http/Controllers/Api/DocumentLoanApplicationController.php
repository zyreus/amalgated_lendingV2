<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentLoanApplication;
use App\Models\DocumentUploadHistory;
use App\Models\LoanProduct;
use App\Models\LoanRequirement;
use App\Models\Role;
use App\Models\UploadedDocument;
use App\Models\User;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class DocumentLoanApplicationController extends Controller
{
    /**
     * Create a document-only loan application (borrower account + JWT).
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'loan_product_id' => 'required|integer|exists:loan_products,id',
            'email' => 'required|email',
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:8|max:72',
            'phone' => 'nullable|string|max:32',
        ]);

        $product = LoanProduct::query()->active()->where('id', $data['loan_product_id'])->first();
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Loan product is not available.'], 422);
        }

        $email = mb_strtolower(trim($data['email']));

        try {
            $result = DB::transaction(function () use ($data, $email, $product) {
                $borrower = User::firstOrCreate(
                    ['email' => $email],
                    [
                        'name' => $data['name'],
                        'password' => Hash::make($data['password']),
                        'role' => 'borrower',
                        'phone' => $data['phone'] ?? null,
                        'is_active' => true,
                    ]
                );

                if (! $borrower->wasRecentlyCreated) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'An account with this email already exists. Log in to continue, or use a different email.',
                    ], 422);
                }

                $borrowerRole = Role::where('slug', 'borrower')->first();
                if ($borrowerRole) {
                    $borrower->roles()->syncWithoutDetaching([$borrowerRole->id]);
                }

                $app = DocumentLoanApplication::create([
                    'user_id' => $borrower->id,
                    'loan_product_id' => $product->id,
                    'status' => DocumentLoanApplication::STATUS_PENDING,
                    'submitted_at' => null,
                    'signed_form_path' => null,
                    'is_signed' => false,
                ]);

                $token = auth('api')->login($borrower);

                return [$app, $borrower, $token];
            });
        } catch (\Throwable $e) {
            report($e);

            return response()->json(['ok' => false, 'message' => 'Could not create application.'], 500);
        }

        if ($result instanceof JsonResponse) {
            return $result;
        }

        [$app, $borrower, $token] = $result;

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($app->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
            'token' => $token,
            'access_token' => $token,
            'token_type' => 'bearer',
            'expires_in' => auth('api')->factory()->getTTL() * 60,
            'user' => [
                'id' => $borrower->id,
                'name' => $borrower->name,
                'email' => $borrower->email,
            ],
        ], 201);
    }

    public function createBorrowerDraft(Request $request): JsonResponse
    {
        $data = $request->validate([
            'loan_product_id' => 'required|integer|exists:loan_products,id',
        ]);

        $product = LoanProduct::query()->active()->where('id', $data['loan_product_id'])->first();
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Loan product is not available.'], 422);
        }

        $user = $request->user();
        if (! $user) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 401);
        }

        $activeOther = DocumentLoanApplication::query()
            ->where('user_id', $user->id)
            ->where('loan_product_id', $product->id)
            ->whereNotNull('submitted_at')
            ->whereIn('status', [DocumentLoanApplication::STATUS_PENDING, DocumentLoanApplication::STATUS_APPROVED])
            ->exists();
        if ($activeOther) {
            return response()->json([
                'ok' => false,
                'message' => 'You already have an active submitted application for this product. Check My Applications or wait for a decision before starting another.',
            ], 422);
        }

        $existing = DocumentLoanApplication::query()
            ->where('user_id', $user->id)
            ->where('loan_product_id', $product->id)
            ->whereNull('submitted_at')
            ->orderByDesc('id')
            ->first();

        if ($existing) {
            return response()->json([
                'ok' => true,
                'loan_application' => $this->serializeApplication($existing->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
            ]);
        }

        $app = DocumentLoanApplication::create([
            'user_id' => $user->id,
            'loan_product_id' => $product->id,
            'status' => DocumentLoanApplication::STATUS_PENDING,
            'submitted_at' => null,
            'signed_form_path' => null,
            'is_signed' => false,
        ]);

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($app->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ], 201);
    }

    public function currentDraft(Request $request): JsonResponse
    {
        $data = $request->validate([
            'loan_product_id' => 'required|integer|exists:loan_products,id',
        ]);

        $user = $request->user();
        if (! $user) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 401);
        }

        $app = DocumentLoanApplication::query()
            ->where('user_id', $user->id)
            ->where('loan_product_id', $data['loan_product_id'])
            ->whereNull('submitted_at')
            ->orderByDesc('id')
            ->first();

        if (! $app) {
            return response()->json(['ok' => false, 'message' => 'No draft application found for this product.'], 404);
        }

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($app->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ]);
    }

    /**
     * Borrower: list document loan applications for dashboard (signed docs section).
     */
    public function borrowerIndex(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = DocumentLoanApplication::query()
            ->where('user_id', $user->id)
            ->with([
                'loanProduct:id,name,slug',
                'uploadedDocuments.loanRequirement:id,loan_product_id,requirement_name,sort_order',
                'user:id,name,email,phone',
            ])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $productIds = $rows->pluck('loan_product_id')->unique()->filter()->values()->all();
        $reqByProduct = collect();
        if ($productIds !== []) {
            $reqByProduct = LoanRequirement::query()
                ->whereIn('loan_product_id', $productIds)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get()
                ->groupBy('loan_product_id');
        }

        return response()->json([
            'ok' => true,
            'data' => $rows->map(function (DocumentLoanApplication $a) use ($reqByProduct) {
                /** @var Collection<int, LoanRequirement> $pre */
                $pre = $reqByProduct->get($a->loan_product_id, collect());

                return $this->serializeApplication($a, $pre);
            }),
        ]);
    }

    public function show(Request $request, DocumentLoanApplication $documentLoanApplication): JsonResponse
    {
        $this->authorizeView($request, $documentLoanApplication);
        $documentLoanApplication->load(['loanProduct.loanRequirements', 'uploadedDocuments.loanRequirement']);

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($documentLoanApplication),
        ]);
    }

    /**
     * Printable HTML (use fetch + blob from SPA with Authorization header).
     */
    public function printApplication(Request $request, DocumentLoanApplication $documentLoanApplication)
    {
        $this->authorizeView($request, $documentLoanApplication);
        $documentLoanApplication->load(['user', 'loanProduct']);

        $user = $documentLoanApplication->user;
        $product = $documentLoanApplication->loanProduct;

        $na = static fn ($v) => ($v === null || $v === '') ? 'N/A' : $v;

        $form = $documentLoanApplication->application_form ?? [];
        $personal = $form['personal'] ?? [];
        $loan = $form['loan'] ?? [];
        $employment = $form['employment'] ?? [];

        return response()->view('print.document_loan_application', [
            'productName' => $product?->name ?? 'N/A',
            'borrowerName' => $user?->name,
            'borrowerEmail' => $user?->email,
            'borrowerPhone' => $user?->phone,
            'borrowerUsername' => $user?->username,
            'applicationId' => $documentLoanApplication->id,
            'applicationDate' => $documentLoanApplication->created_at?->format('Y-m-d H:i'),
            'address' => $personal['address'] ?? null,
            'employer' => $employment['employer_name'] ?? null,
            'loanType' => $loan['loan_type'] ?? null,
            'loanAmount' => $loan['loan_amount'] ?? null,
            'loanPurpose' => $loan['purpose'] ?? null,
            'loanTerms' => $loan['terms'] ?? null,
            'fullName' => $personal['full_name'] ?? null,
            'dateOfBirth' => $personal['date_of_birth'] ?? null,
            'civilStatus' => $personal['civil_status'] ?? null,
            'employmentStatus' => $employment['employment_status'] ?? null,
            'monthlyIncome' => $employment['monthly_income'] ?? null,
            'otherIncome' => $employment['other_income'] ?? null,
            'generatedAt' => now()->format('Y-m-d H:i'),
            'na' => $na,
        ], 200, ['Content-Type' => 'text/html; charset=UTF-8']);
    }

    public function upload(Request $request): JsonResponse
    {
        return $this->processRequirementUpload($request);
    }

    public function reupload(Request $request): JsonResponse
    {
        return $this->processRequirementUpload($request);
    }

    private function processRequirementUpload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_loan_application_id' => 'required|integer|exists:document_loan_applications,id',
            'requirement_id' => 'required|integer|exists:loan_requirements,id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:15360',
        ]);

        /** @var DocumentLoanApplication $app */
        $app = DocumentLoanApplication::query()->findOrFail($data['document_loan_application_id']);

        if ($app->submitted_at !== null) {
            return response()->json(['ok' => false, 'message' => 'This application is already submitted.'], 422);
        }

        $user = $request->user();
        if (! $user || (int) $app->user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403);
        }

        $req = LoanRequirement::query()
            ->where('id', $data['requirement_id'])
            ->where('loan_product_id', $app->loan_product_id)
            ->first();
        if (! $req) {
            return response()->json(['ok' => false, 'message' => 'Invalid requirement for this product.'], 422);
        }

        $file = $request->file('file');
        $dir = 'documents/document-applications/'.$app->id;

        $existing = UploadedDocument::query()
            ->where('document_loan_application_id', $app->id)
            ->where('loan_requirement_id', $req->id)
            ->first();

        if ($existing !== null && ! $this->borrowerMayReplaceRequirementUpload($app, $existing)) {
            return response()->json([
                'ok' => false,
                'message' => 'This file is awaiting review. You can replace it only if it was rejected, or after you have uploaded a signed application form.',
            ], 422);
        }

        $path = $file->store($dir, 'public');

        if ($existing === null) {
            $upload = UploadedDocument::query()->create([
                'document_loan_application_id' => $app->id,
                'loan_requirement_id' => $req->id,
                'file_path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'status' => UploadedDocument::STATUS_PENDING,
                'remarks' => null,
                'version' => 1,
            ]);
        } else {
            if ($existing->file_path) {
                DocumentUploadHistory::query()->create([
                    'uploaded_document_id' => $existing->id,
                    'file_path' => $existing->file_path,
                    'original_name' => $existing->original_name,
                    'version' => $existing->version,
                ]);
                Storage::disk('public')->delete($existing->file_path);
            }

            $existing->file_path = $path;
            $existing->original_name = $file->getClientOriginalName();
            $existing->status = UploadedDocument::STATUS_PENDING;
            $existing->remarks = null;
            $existing->version = (int) $existing->version + 1;
            $existing->save();
            $upload = $existing->fresh('loanRequirement');
        }

        return response()->json([
            'ok' => true,
            'upload' => $this->serializeUpload($upload, $app),
        ]);
    }

    public function uploadSignedForm(Request $request): JsonResponse
    {
        $data = $request->validate([
            'document_loan_application_id' => 'required|integer|exists:document_loan_applications,id',
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:15360',
        ]);

        /** @var DocumentLoanApplication $app */
        $app = DocumentLoanApplication::query()->findOrFail($data['document_loan_application_id']);

        if ($app->submitted_at !== null) {
            return response()->json(['ok' => false, 'message' => 'This application is already submitted.'], 422);
        }

        $user = $request->user();
        if (! $user || (int) $app->user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403);
        }

        $file = $request->file('file');
        $dir = 'documents/signed-forms/'.$app->id;
        $path = $file->store($dir, 'public');

        if ($app->signed_form_path) {
            Storage::disk('public')->delete($app->signed_form_path);
        }

        $app->signed_form_path = $path;
        $app->is_signed = true;
        $app->save();

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($app->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ]);
    }

    public function submit(Request $request, DocumentLoanApplication $documentLoanApplication): JsonResponse
    {
        $user = $request->user();
        if (! $user || (int) $documentLoanApplication->user_id !== (int) $user->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403);
        }

        if ($documentLoanApplication->submitted_at !== null) {
            return response()->json(['ok' => false, 'message' => 'Already submitted.'], 422);
        }

        $duplicateActive = DocumentLoanApplication::query()
            ->where('user_id', $documentLoanApplication->user_id)
            ->where('loan_product_id', $documentLoanApplication->loan_product_id)
            ->whereNotNull('submitted_at')
            ->whereIn('status', [DocumentLoanApplication::STATUS_PENDING, DocumentLoanApplication::STATUS_APPROVED])
            ->where('id', '!=', $documentLoanApplication->id)
            ->exists();
        if ($duplicateActive) {
            return response()->json([
                'ok' => false,
                'message' => 'Another active application for this product is already on file. Contact support if you need to replace it.',
            ], 422);
        }

        $requirements = LoanRequirement::query()->where('loan_product_id', $documentLoanApplication->loan_product_id)->pluck('id');
        $uploaded = UploadedDocument::query()
            ->where('document_loan_application_id', $documentLoanApplication->id)
            ->whereIn('loan_requirement_id', $requirements)
            ->pluck('loan_requirement_id');

        if ($uploaded->count() < $requirements->count()) {
            return response()->json([
                'ok' => false,
                'message' => 'Upload all required documents before submitting.',
            ], 422);
        }

        if (! $documentLoanApplication->signed_form_path || ! $documentLoanApplication->is_signed) {
            return response()->json([
                'ok' => false,
                'message' => 'Upload your signed application form before submitting.',
            ], 422);
        }

        $documentLoanApplication->submitted_at = now();
        $documentLoanApplication->save();

        $documentLoanApplication->loadMissing('loanProduct');
        $productName = $documentLoanApplication->loanProduct?->name ?? 'Loan product';
        $nc = app(NotificationCenter::class);
        $nc->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_SUBMITTED,
            'document_loan_submitted',
            'Document loan application submitted',
            $user->name.' submitted application #'.$documentLoanApplication->id.' ('.$productName.').',
            [
                'document_loan_application_id' => $documentLoanApplication->id,
                'borrower_id' => $user->id,
            ],
            null,
            ['module' => NotificationCenter::MODULE_LOANS],
        );
        $nc->notifyBorrower(
            $user,
            NotificationCenter::CATEGORY_LOAN_SUBMITTED,
            'document_application_submitted',
            'Application submitted',
            'Your document-based application #'.$documentLoanApplication->id.' was received. Our team will review it shortly.',
            ['document_loan_application_id' => $documentLoanApplication->id],
            ['dedupe_key' => 'docloan_submit:'.$documentLoanApplication->id, 'module' => NotificationCenter::MODULE_LOANS],
        );

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($documentLoanApplication->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ]);
    }

    /**
     * Multi-step wizard: save validated section data (borrower). Optional advance marks step as passed for UI checkmarks.
     */
    public function patchWizard(Request $request, DocumentLoanApplication $documentLoanApplication): JsonResponse
    {
        $this->authorizeBorrowerOwner($request, $documentLoanApplication);

        if ($documentLoanApplication->submitted_at !== null) {
            return response()->json(['ok' => false, 'message' => 'This application is already submitted.'], 422);
        }

        $payload = $request->validate([
            'step' => 'required|integer|in:1,2,3,4',
            'advance' => 'sometimes|boolean',
            'data' => 'required|array',
        ]);

        $step = (int) $payload['step'];
        $data = $payload['data'];
        $advance = (bool) ($payload['advance'] ?? false);

        $form = $documentLoanApplication->application_form ?? [];

        switch ($step) {
            case 1:
                $merged = Validator::make($data, [
                    'full_name' => 'required|string|max:255',
                    'address' => 'required|string|max:500',
                    'phone' => 'required|string|max:32',
                    'email' => 'required|email|max:255',
                    'date_of_birth' => 'required|date',
                    'civil_status' => 'required|string|max:64',
                ])->validate();
                $form['personal'] = array_merge($form['personal'] ?? [], $merged);
                break;
            case 2:
                $merged = Validator::make($data, [
                    'loan_type' => 'required|string|max:128',
                    'loan_amount' => 'required|numeric|min:0',
                    'purpose' => 'required|string|max:2000',
                    'terms' => 'required|string|max:64',
                ])->validate();
                $form['loan'] = array_merge($form['loan'] ?? [], $merged);
                break;
            case 3:
                $merged = Validator::make($data, [
                    'employment_status' => 'required|string|max:128',
                    'monthly_income' => 'required|numeric|min:0',
                    'employer_name' => 'required|string|max:255',
                    'other_income' => 'nullable|numeric|min:0',
                ])->validate();
                $form['employment'] = array_merge($form['employment'] ?? [], $merged);
                break;
            case 4:
                $form['preview'] = array_merge($form['preview'] ?? [], [
                    'confirmed_at' => now()->toIso8601String(),
                ]);
                break;
        }

        $documentLoanApplication->application_form = $form;

        if ($advance) {
            $documentLoanApplication->wizard_highest_passed_step = max(
                (int) $documentLoanApplication->wizard_highest_passed_step,
                $step
            );
        }

        $documentLoanApplication->save();

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($documentLoanApplication->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ]);
    }

    /**
     * Embedded wizard uploads: valid ID, proof of income, or additional files (stored on public disk under documents/{id}).
     */
    public function uploadEmbeddedDocument(Request $request, DocumentLoanApplication $documentLoanApplication): JsonResponse
    {
        $this->authorizeBorrowerOwner($request, $documentLoanApplication);

        if ($documentLoanApplication->submitted_at !== null) {
            return response()->json(['ok' => false, 'message' => 'This application is already submitted.'], 422);
        }

        $data = $request->validate([
            'slot' => 'required|string|in:valid_id,proof_income,additional',
            // Keep embedded uploads generous; phone screenshots can exceed 10MB.
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:15360',
            'replace_index' => 'nullable|integer|min:0',
        ]);

        $file = $request->file('file');
        $dir = 'documents/'.$documentLoanApplication->id;
        $original = $file->getClientOriginalName();
        $safeBase = Str::slug(pathinfo($original, PATHINFO_FILENAME)) ?: 'file';
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION) ?: 'bin');
        $filename = $safeBase.'-'.Str::lower(Str::random(6)).'.'.$ext;
        $path = $file->storeAs($dir, $filename, 'public');

        $slot = $data['slot'];

        if ($slot === 'valid_id') {
            if ($documentLoanApplication->valid_id_path) {
                Storage::disk('public')->delete($documentLoanApplication->valid_id_path);
            }
            $documentLoanApplication->valid_id_path = $path;
        } elseif ($slot === 'proof_income') {
            if ($documentLoanApplication->proof_income_path) {
                Storage::disk('public')->delete($documentLoanApplication->proof_income_path);
            }
            $documentLoanApplication->proof_income_path = $path;
        } else {
            $paths = $documentLoanApplication->additional_document_paths ?? [];
            $replaceIndex = $request->input('replace_index');
            if ($replaceIndex !== null && isset($paths[$replaceIndex])) {
                Storage::disk('public')->delete($paths[$replaceIndex]);
                $paths[$replaceIndex] = $path;
            } else {
                $paths[] = $path;
            }
            $documentLoanApplication->additional_document_paths = array_values($paths);
        }

        $documentLoanApplication->save();

        return response()->json([
            'ok' => true,
            'loan_application' => $this->serializeApplication($documentLoanApplication->fresh(['loanProduct', 'uploadedDocuments.loanRequirement'])),
        ]);
    }

    private function authorizeBorrowerOwner(Request $request, DocumentLoanApplication $app): void
    {
        $user = $request->user();
        if (! $user || (int) $app->user_id !== (int) $user->id) {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403));
        }
    }

    private function borrowerMayReplaceRequirementUpload(DocumentLoanApplication $app, UploadedDocument $existing): bool
    {
        if ($existing->status === UploadedDocument::STATUS_REJECTED) {
            return true;
        }

        return (bool) $app->is_signed;
    }

    private function authorizeView(Request $request, DocumentLoanApplication $app): void
    {
        $user = $request->user();
        if ($user && (int) $app->user_id === (int) $user->id) {
            return;
        }
        if ($user && $user->canAccessAdminPortal()) {
            return;
        }
        abort(response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403));
    }

    /**
     * @param  Collection<int, LoanRequirement>|null  $requirementsPreloaded  When listing many applications, pass per-product requirements to avoid N+1 queries.
     */
    private function serializeApplication(DocumentLoanApplication $app, ?Collection $requirementsPreloaded = null): array
    {
        $app->loadMissing([
            'loanProduct:id,name,slug',
            'uploadedDocuments.loanRequirement:id,loan_product_id,requirement_name,sort_order',
            'user:id,name,email,phone',
        ]);

        if ($requirementsPreloaded !== null) {
            $reqs = $requirementsPreloaded;
        } else {
            $reqs = LoanRequirement::query()
                ->where('loan_product_id', $app->loan_product_id)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();
        }

        $byReq = $app->uploadedDocuments->keyBy('loan_requirement_id');

        $items = $reqs->map(function (LoanRequirement $r) use ($byReq, $app) {
            $u = $byReq->get($r->id);

            return [
                'requirement' => [
                    'id' => $r->id,
                    'requirement_name' => $r->requirement_name,
                    'sort_order' => $r->sort_order,
                ],
                'upload' => $u ? $this->serializeUpload($u, $app) : null,
            ];
        });

        $total = $reqs->count();
        $done = $byReq->count();
        $signedOk = (bool) ($app->signed_form_path && $app->is_signed);

        $additional = $app->additional_document_paths ?? [];
        $additionalUrls = array_map(fn ($p) => $p ? PublicStorageUrl::apiUrl($p) : null, is_array($additional) ? $additional : []);

        return [
            'id' => $app->id,
            'loan_product_id' => $app->loan_product_id,
            'status' => $app->status,
            'submitted_at' => $app->submitted_at?->toIso8601String(),
            'created_at' => $app->created_at?->toIso8601String(),
            'signed_form_path' => $app->signed_form_path,
            'signed_form_url' => $app->signed_form_path ? PublicStorageUrl::apiUrl($app->signed_form_path) : null,
            'is_signed' => (bool) $app->is_signed,
            'application_form' => $app->application_form,
            'wizard' => [
                'highest_passed_step' => (int) ($app->wizard_highest_passed_step ?? 0),
            ],
            'embedded_documents' => [
                'valid_id_path' => $app->valid_id_path,
                'valid_id_url' => $app->valid_id_path ? PublicStorageUrl::apiUrl($app->valid_id_path) : null,
                'proof_income_path' => $app->proof_income_path,
                'proof_income_url' => $app->proof_income_path ? PublicStorageUrl::apiUrl($app->proof_income_path) : null,
                'additional_paths' => is_array($additional) ? $additional : [],
                'additional_urls' => $additionalUrls,
            ],
            'product' => $app->loanProduct ? [
                'id' => $app->loanProduct->id,
                'name' => $app->loanProduct->name,
                'slug' => $app->loanProduct->slug,
            ] : null,
            'requirements' => $items,
            'progress' => [
                'uploaded' => $done,
                'total' => $total,
                'signed_form' => $signedOk,
            ],
            'can_submit' => $total > 0 && $done >= $total && $signedOk && $app->submitted_at === null,
        ];
    }

    private function serializeUpload(UploadedDocument $u, DocumentLoanApplication $app): array
    {
        return [
            'id' => $u->id,
            'loan_requirement_id' => $u->loan_requirement_id,
            'file_path' => $u->file_path,
            'original_name' => $u->original_name,
            'status' => $u->status,
            'remarks' => $u->remarks,
            'version' => (int) $u->version,
            'can_replace' => $this->borrowerMayReplaceRequirementUpload($app, $u),
            'url' => $u->file_path ? PublicStorageUrl::apiUrl($u->file_path) : null,
        ];
    }
}
