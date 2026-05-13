<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LoanListResource;
use App\Jobs\SendLoanApplicationReceivedJob;
use App\Jobs\SendLoanDecisionJob;
use App\Mail\LoanDecisionMail;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Models\LoanProduct;
use App\Models\Payment;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\LoanAmortizationService;
use App\Services\LoanCalculator;
use App\Services\LoanProductRateResolver;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class LoanController extends Controller
{
    public function __construct(
        private LoanCalculator $calculator,
        private LoanAmortizationService $amortization,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    public function index(Request $request): JsonResponse
    {
        /**
         * `application_payload` is a JSON column that stores the full borrower wizard
         * snapshot (signatures, schedule snapshot, calculator output…). Loading it for
         * every row in the admin loan table is wasteful — the list view only needs the
         * three product-quote keys that {@see LoanListResource::quotedPayloadSnippet()}
         * extracts. We synthesize those keys with `JSON_EXTRACT` so the heavy column
         * never leaves MySQL.
         */
        $payloadExtract = 'JSON_OBJECT('
            ."'loan_product_slug', JSON_UNQUOTE(JSON_EXTRACT(application_payload, '$.loan_product_slug')), "
            ."'selected_rate_type', JSON_UNQUOTE(JSON_EXTRACT(application_payload, '$.selected_rate_type')), "
            ."'selected_interest_rate', JSON_EXTRACT(application_payload, '$.selected_interest_rate')"
            .') as application_payload';

        $q = Loan::query()
            ->select([
                'id',
                'borrower_id',
                'principal',
                'requested_principal',
                'term_months',
                'annual_interest_rate',
                'adjusted_monthly_rate_percent',
                'whole_term_interest_percent',
                'monthly_principal',
                'monthly_interest',
                'service_charge',
                'mri_fee',
                'doc_stamp',
                'notarial_fee',
                'mortgage_fee',
                'total_deductions',
                'net_proceeds',
                'total_payment',
                'monthly_payment',
                'total_interest',
                'outstanding_balance',
                'status',
                'assigned_officer_id',
                'approved_by',
                'approved_at',
                'disbursed_at',
                'completed_at',
                'created_at',
                'updated_at',
            ])
            ->selectRaw($payloadExtract)
            ->with([
                'borrower:id,name,email,phone',
                'approver:id,name,email',
                'assignedOfficer:id,name,email',
            ]);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($search = $request->query('search')) {
            $like = '%'.$search.'%';
            /** Subquery on `users` avoids correlated `whereHas` per loan row (better plan with `users.email` / name lookups). */
            $q->whereIn('borrower_id', function ($sub) use ($like) {
                $sub->select('id')
                    ->from('users')
                    ->where(function ($w) use ($like) {
                        $w->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $loans = $q->orderByDesc('id')->paginate((int) $request->query('per_page', 15));

        $loans->setCollection(LoanListResource::collection($loans->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $loans]);
    }

    public function show(Loan $loan): JsonResponse
    {
        $loan->load([
            'borrower',
            'approver',
            'payments',
            'receipts',
            'loanApplication.documents.verifiedBy',
            'loanApplication.coMaker',
            'loanApplication.travelLoanWizardForm',
            'loanApplication.dependents',
            'loanApplication.contactPersons',
            'loanApplication.creditMemorandum',
        ]);

        if ($loan->loanApplication) {
            $this->augmentLoanApplicationForAdminResponse($loan->loanApplication);
        }

        $lastDecisionEmail = EmailLog::query()
            ->where('loan_id', $loan->id)
            ->where('notification_type', EmailLog::NOTIFICATION_LOAN_DECISION)
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'loan' => $loan,
            'last_loan_decision_email' => $this->formatLoanDecisionEmailLog($lastDecisionEmail),
        ]);
    }

    public function approve(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:5000',
            'approved_principal' => 'sometimes|numeric|min:0.01',
            'term_months' => 'sometimes|integer|min:1|max:600',
            'monthly_rate_percent' => 'sometimes|numeric|min:0|max:100',
        ]);

        if ($loan->status !== Loan::STATUS_PENDING) {
            return response()->json(['ok' => false, 'message' => 'Only pending loans can be approved.'], 422);
        }

        $payload = is_array($loan->application_payload) ? $loan->application_payload : [];
        $productSlug = isset($payload['loan_product_slug']) && is_string($payload['loan_product_slug'])
            ? trim($payload['loan_product_slug'])
            : null;
        if (! $productSlug) {
            // Travel wizard + other flows might attach loanApplication (legacy).
            $la = $loan->loanApplication;
            if ($la) {
                $productSlug = match ($la->loan_type) {
                    LoanApplication::TYPE_REAL_ESTATE => 'real-estate-mortgage',
                    LoanApplication::TYPE_CHATTEL => 'chattel-mortgage',
                    LoanApplication::TYPE_SALARY => 'salary-loan',
                    LoanApplication::TYPE_TRAVEL_ASSISTANCE => 'travel-assistance-loan',
                    LoanApplication::TYPE_SSS_PENSION => 'sss-pension-loan',
                    default => null,
                };
            }
        }

        $applicationNature = (string) ($payload['application_nature'] ?? 'new');
        $age = $payload['age'] ?? null;
        $monthlyPension = $payload['monthly_pension'] ?? null;
        $pensionType = $payload['pension_type'] ?? null;

        $result = DB::transaction(function () use ($request, $loan, $logger, $productSlug, $applicationNature, $age, $monthlyPension, $pensionType) {
            $loan = Loan::query()
                ->whereKey($loan->getKey())
                ->lockForUpdate()
                ->with('loanApplication')
                ->firstOrFail();

            if ($loan->status !== Loan::STATUS_PENDING) {
                return response()->json(['ok' => false, 'message' => 'Only pending loans can be approved.'], 422);
            }

            $principal = (float) $loan->principal;
            if ($request->filled('approved_principal')) {
                $principal = round((float) $request->input('approved_principal'), 2);
                $loan->principal = $principal;
            }
            $termUse = (int) $loan->term_months;
            if ($request->filled('term_months')) {
                $termUse = (int) $request->input('term_months');
                $loan->term_months = $termUse;
            }
            $rateOverride = $request->filled('monthly_rate_percent') ? (float) $request->input('monthly_rate_percent') : null;
            if (! is_string($productSlug) || trim($productSlug) === '') {
                // Legacy continuity: admin-created loans might not have product slug persisted yet.
                // Infer from configured monthly interest rate (official product rates are controlled).
                $monthlyRateGuess = null;
                $appPayloadLocal = is_array($loan->application_payload) ? $loan->application_payload : [];
                if (isset($appPayloadLocal['selected_interest_rate']) && is_numeric($appPayloadLocal['selected_interest_rate'])) {
                    $monthlyRateGuess = (float) $appPayloadLocal['selected_interest_rate'];
                } else {
                    $monthlyRateGuess = (float) ($loan->annual_interest_rate / 12.0);
                }

                $candidate = LoanProduct::query()
                    ->active()
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get()
                    ->first(function (LoanProduct $p) use ($monthlyRateGuess) {
                        return abs((float) $p->interest_rate - (float) $monthlyRateGuess) < 0.0001;
                    });

                $productSlug = $candidate?->slug ?? 'real-estate-mortgage';
            }

            $compute = $this->calculator->compute([
                'product_slug' => (string) $productSlug,
                'loan_amount' => $principal,
                'term_months' => $termUse,
                'application_nature' => $applicationNature,
                'age' => $age !== null && $age !== '' ? (int) $age : null,
                'monthly_pension' => $monthlyPension !== null && $monthlyPension !== '' ? (float) $monthlyPension : null,
                'pension_type' => $pensionType !== null && $pensionType !== '' ? (string) $pensionType : null,
                'monthly_rate_percent_override' => $rateOverride,
            ]);

            $product = is_array($compute['product'] ?? null) ? $compute['product'] : [];
            $breakdown = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [];
            $schedule = is_array($compute['schedule'] ?? null) ? $compute['schedule'] : [];

            $monthlyRate = isset($product['monthly_rate_percent_effective']) ? (float) $product['monthly_rate_percent_effective'] : null;
            if ($monthlyRate !== null) {
                $loan->annual_interest_rate = round($monthlyRate * 12.0, 4);
            }
            $loan->adjusted_monthly_rate_percent = $rateOverride !== null ? round((float) $rateOverride, 4) : ($monthlyRate !== null ? round($monthlyRate, 4) : null);
            $loan->whole_term_interest_percent = isset($breakdown['whole_term_interest_percent']) ? (float) $breakdown['whole_term_interest_percent'] : null;
            $loan->monthly_principal = isset($breakdown['monthly_principal']) ? round((float) $breakdown['monthly_principal'], 2) : null;
            $loan->monthly_interest = isset($breakdown['monthly_interest']) ? round((float) $breakdown['monthly_interest'], 2) : null;
            $loan->service_charge = isset($breakdown['service_charge']) ? round((float) $breakdown['service_charge'], 2) : null;
            $loan->mri_fee = isset($breakdown['mri_fee']) ? round((float) $breakdown['mri_fee'], 2) : (isset($breakdown['insurance']) ? round((float) $breakdown['insurance'], 2) : null);
            $loan->doc_stamp = isset($breakdown['doc_stamp']) ? round((float) $breakdown['doc_stamp'], 2) : null;
            $loan->notarial_fee = isset($breakdown['notarial_fee']) ? round((float) $breakdown['notarial_fee'], 2) : null;
            $loan->mortgage_fee = isset($breakdown['mortgage_fee']) ? round((float) $breakdown['mortgage_fee'], 2) : null;
            $loan->total_deductions = isset($breakdown['total_deductions']) ? round((float) $breakdown['total_deductions'], 2) : null;
            $loan->net_proceeds = isset($breakdown['net_proceeds']) ? round((float) $breakdown['net_proceeds'], 2) : null;
            $loan->total_payment = isset($breakdown['total_payment']) ? round((float) $breakdown['total_payment'], 2) : null;
            $loan->status = Loan::STATUS_ONGOING;
            $loan->approved_by = $request->user()->id;
            $loan->approved_at = now();
            $loan->rejected_at = null;
            $loan->disbursed_at = now();
            $loan->monthly_payment = isset($breakdown['monthly_amortization']) ? (float) $breakdown['monthly_amortization'] : $loan->monthly_payment;
            $loan->total_interest = isset($breakdown['total_add_on_interest']) ? (float) $breakdown['total_add_on_interest'] : $loan->total_interest;
            $loan->schedule_json = $schedule;
            $loan->outstanding_balance = round((float) array_sum(array_map(fn ($r) => (float) ($r['payment'] ?? 0), $schedule)), 2);
            $loan->admin_notes = $request->input('admin_notes') ?? $loan->admin_notes;

            $loanApp = $loan->loanApplication;
            if ($loanApp && $loanApp->loan_amount !== null) {
                $loan->requested_principal = round((float) $loanApp->loan_amount, 2);
            } elseif ($loan->requested_principal === null) {
                $loan->requested_principal = round((float) $loan->principal, 2);
            }

            $overrideLogs = is_array($loan->admin_override_logs) ? $loan->admin_override_logs : [];
            $overrideLogs[] = [
                'event' => 'approve_recompute',
                'at' => now()->toIso8601String(),
                'admin_user_id' => $request->user()->id,
                'principal' => $principal,
                'term_months' => $termUse,
                'monthly_rate_percent_override' => $rateOverride,
                'product_slug' => (string) $productSlug,
            ];
            $loan->admin_override_logs = $overrideLogs;

            $loan->loan_computation_snapshot = [
                'engine' => 'LoanCalculator/v2',
                'product' => is_array($compute['product'] ?? null) ? $compute['product'] : [],
                'inputs' => is_array($compute['inputs'] ?? null) ? $compute['inputs'] : [],
                'breakdown' => is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [],
                'summary' => is_array($compute['summary'] ?? null) ? $compute['summary'] : [],
                'schedule' => is_array($compute['schedule'] ?? null) ? $compute['schedule'] : [],
                'generated_at' => now()->toIso8601String(),
            ];

            $loan->save();

            if ($loanApp) {
                $loanApp->status = LoanApplication::STATUS_APPROVED;
                $loanApp->verified_at = now();
                $loanApp->rejection_reason = null;
                $loanApp->approved_amount = round((float) $loan->principal, 2);
                $loanApp->save();
            }

            // Rebuild payment ledger from official schedule.
            $termMonths = max(1, (int) $loan->term_months);
            Payment::query()->where('loan_id', $loan->id)->delete();
            foreach ($schedule as $row) {
                $instNo = (int) ($row['installment_no'] ?? 0);
                Payment::create([
                    'loan_id' => $loan->id,
                    'installment_no' => $instNo,
                    'is_final_payment' => $instNo === $termMonths,
                    'due_date' => $row['due_date'] ?? null,
                    'amount_due' => (float) ($row['payment'] ?? ($row['amortization'] ?? 0)),
                    'principal_portion' => (float) ($row['principal'] ?? 0),
                    'interest_portion' => (float) ($row['interest'] ?? 0),
                    'status' => Payment::STATUS_PENDING,
                    'source' => 'system',
                    'penalty_amount' => 0.0,
                ]);
            }

            // Persist an SOA snapshot for historical accuracy (used by SOA printable templates).
            $appPayload = is_array($loan->application_payload) ? $loan->application_payload : [];
            $appPayload['loan_product_slug'] = $appPayload['loan_product_slug'] ?? (string) ($product['slug'] ?? $productSlug);
            $appPayload['soa_engine_version'] = 'soa_v2';
            $appPayload['soa_snapshot'] = [
                'product' => $product,
                'inputs' => is_array($compute['inputs'] ?? null) ? $compute['inputs'] : [],
                'breakdown' => $breakdown,
                'summary' => is_array($compute['summary'] ?? null) ? $compute['summary'] : [],
                'notes' => is_array($compute['notes'] ?? null) ? $compute['notes'] : [],
                'generated_at' => now()->toIso8601String(),
            ];
            $loan->application_payload = $appPayload;
            $loan->save();

            $logger->log($request->user(), 'loans.approve', $loan, ['loan_id' => $loan->id]);

            return $loan->fresh(['payments']);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }
        $result->loadMissing(['borrower', 'approver']);
        $this->notifyBorrowerLoanDecision($result);

        $nc = app(NotificationCenter::class);
        if ($result->borrower) {
            $nc->notifyBorrower(
                $result->borrower,
                NotificationCenter::CATEGORY_LOAN_APPROVED,
                'loan_approved',
                'Loan approved',
                'Your loan #'.$result->id.' was approved. Your repayment schedule is ready in the borrower portal.',
                ['loan_id' => $result->id],
                ['dedupe_key' => 'loan_decision:'.$result->id, 'module' => NotificationCenter::MODULE_LOANS],
            );
        }
        $nc->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_APPROVED,
            'loan_approved',
            'Loan approved',
            'Loan #'.$result->id.($result->borrower ? ' — '.$result->borrower->name : '').' was approved.',
            ['loan_id' => $result->id],
            (int) $request->user()->id,
            ['module' => NotificationCenter::MODULE_LOANS],
        );

        $lastDecisionEmail = EmailLog::query()
            ->where('loan_id', $result->id)
            ->where('notification_type', EmailLog::NOTIFICATION_LOAN_DECISION)
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'loan' => $result,
            'last_loan_decision_email' => $this->formatLoanDecisionEmailLog($lastDecisionEmail),
            'email_notification_queued' => true,
        ]);
    }

    public function reject(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => 'required|string|max:2000',
        ]);

        $result = DB::transaction(function () use ($request, $loan, $logger, $data) {
            $locked = Loan::query()
                ->whereKey($loan->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            if ($locked->status !== Loan::STATUS_PENDING) {
                return response()->json(['ok' => false, 'message' => 'Only pending loans can be rejected.'], 422);
            }

            $locked->status = Loan::STATUS_REJECTED;
            $locked->rejection_reason = $data['rejection_reason'];
            $locked->approved_by = $request->user()->id;
            $locked->approved_at = null;
            $locked->rejected_at = now();
            $locked->save();

            $loanApp = $locked->loanApplication;
            if ($loanApp) {
                $loanApp->status = LoanApplication::STATUS_REJECTED;
                $loanApp->verified_at = now();
                $loanApp->rejection_reason = $data['rejection_reason'];
                $loanApp->save();
            }

            $logger->log($request->user(), 'loans.reject', $locked);

            return $locked->fresh(['borrower', 'approver', 'loanApplication']);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $this->notifyBorrowerLoanDecision($result);

        $nc = app(NotificationCenter::class);
        if ($result->borrower) {
            $nc->notifyBorrower(
                $result->borrower,
                NotificationCenter::CATEGORY_LOAN_REJECTED,
                'loan_rejected',
                'Loan application update',
                'Your loan #'.$result->id.' was not approved. Reason: '.mb_substr((string) $result->rejection_reason, 0, 500),
                ['loan_id' => $result->id],
                ['dedupe_key' => 'loan_decision:'.$result->id, 'module' => NotificationCenter::MODULE_LOANS, 'priority' => 4],
            );
        }
        $nc->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_REJECTED,
            'loan_rejected',
            'Loan rejected',
            'Loan #'.$result->id.($result->borrower ? ' — '.$result->borrower->name : '').' was rejected.',
            ['loan_id' => $result->id],
            (int) $request->user()->id,
            ['module' => NotificationCenter::MODULE_LOANS],
        );

        $lastDecisionEmail = EmailLog::query()
            ->where('loan_id', $result->id)
            ->where('notification_type', EmailLog::NOTIFICATION_LOAN_DECISION)
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'loan' => $result,
            'last_loan_decision_email' => $this->formatLoanDecisionEmailLog($lastDecisionEmail),
            'email_notification_queued' => true,
        ]);
    }

    public function publicApply(Request $request): JsonResponse
    {
        if ($request->hasFile('face_photo')) {
            $data = $request->validate([
                'email' => 'required|email',
                'name' => 'required|string|max:255',
                'phone' => 'nullable|string|max:32',
                'password' => 'required|string|min:8|max:72',
                'principal' => 'required|numeric|min:1000',
                'term_months' => 'required|integer|min:1|max:360',
                'application_payload' => 'nullable|string',
                'face_photo' => 'required|file|mimes:jpg,jpeg,png|max:5120',
                'doc_payslip' => 'required|file|mimes:jpg,jpeg,png,pdf|max:10240',
                'doc_proof_of_income' => 'required|file|mimes:jpg,jpeg,png,pdf|max:10240',
                'doc_government_id' => 'required|file|mimes:jpg,jpeg,png,pdf|max:10240',
            ]);
            $data['application_payload'] = $this->decodeApplicationPayload($data['application_payload'] ?? null);

            return $this->createPendingLoanFromInput($data, $request);
        }

        $data = $request->validate([
            'email' => 'required|email',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:32',
            'password' => 'required|string|min:8|max:72',
            'principal' => 'required|numeric|min:1000',
            'term_months' => 'required|integer|min:1|max:360',
            'application_payload' => 'nullable|array',
            'loan_product_slug' => 'nullable|string|max:190',
        ]);

        return $this->createPendingLoanFromInput($data, null);
    }

    /**
     * @param  string|null  $raw  JSON string from multipart form
     */
    private function decodeApplicationPayload(?string $raw): array
    {
        if ($raw === null || $raw === '') {
            return [];
        }
        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * Admin creates a pending loan application (same rules as public apply).
     */
    public function store(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'email' => 'required|email',
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:32',
            'password' => 'required|string|min:8|max:72',
            'principal' => 'required|numeric|min:1000',
            'term_months' => 'required|integer|min:1|max:360',
            'application_payload' => 'nullable|array',
            'loan_product_slug' => 'nullable|string|max:190',
        ]);

        $response = $this->createPendingLoanFromInput($data, null);
        $payload = $response->getData(true);
        if (! empty($payload['loan_id'])) {
            $loan = Loan::find($payload['loan_id']);
            if ($loan) {
                $logger->log($request->user(), 'loans.create', $loan, ['loan_id' => $loan->id]);
            }
        }

        return $response;
    }

    private function createPendingLoanFromInput(array $data, ?Request $request): JsonResponse
    {
        $borrower = User::firstOrCreate(
            ['email' => $data['email']],
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

        // Always attach borrower RBAC for this user when they are tied to a loan (not only on new rows —
        // firstOrCreate can return an older user that never had the pivot).
        $borrowerRole = Role::where('slug', 'borrower')->first();
        if ($borrowerRole) {
            $borrower->roles()->syncWithoutDetaching([$borrowerRole->id]);
        }

        $payload = $data['application_payload'] ?? [];
        if (! is_array($payload)) {
            $payload = [];
        }

        $topSlug = isset($data['loan_product_slug']) ? trim((string) $data['loan_product_slug']) : '';
        if ($topSlug !== '') {
            $payload['loan_product_slug'] = $topSlug;
        }

        $slug = isset($payload['loan_product_slug']) ? trim((string) $payload['loan_product_slug']) : '';
        $termMonths = max(1, (int) $data['term_months']);

        if ($slug !== '') {
            $fbMonthly = LoanProductRateResolver::fallbackMonthlyPercentForSlug($slug)
                ?? (((float) $this->defaultAnnualRate()) / 12.0);
            $annual = $this->loanProductRates->resolveAnnualStoredPercent($slug, (float) $fbMonthly, $termMonths);
            $monthlyPct = $this->loanProductRates->resolveMonthlyRatePercent($slug, (float) $fbMonthly, $termMonths);
            $payload['loan_product_slug'] = $slug;
            $payload['selected_interest_rate'] = round($monthlyPct, 4);
            $payload['selected_rate_type'] = 'monthly';
            $rate = $annual;
        } else {
            $rate = $this->defaultAnnualRate();
        }

        $loan = Loan::create([
            'borrower_id' => $borrower->id,
            'principal' => $data['principal'],
            'term_months' => $data['term_months'],
            'annual_interest_rate' => $rate,
            'status' => Loan::STATUS_PENDING,
            'application_payload' => $payload,
        ]);

        if ($request && $request->hasFile('face_photo')) {
            $face = $request->file('face_photo');
            $loan->face_photo_path = $face->store("loan-applications/{$loan->id}", 'public');
            $loan->face_capture_at = now();

            $docSlots = [
                'doc_payslip' => 'Payslip',
                'doc_proof_of_income' => 'Proof of income',
                'doc_government_id' => 'Government valid ID',
            ];
            $docs = [];
            foreach ($docSlots as $field => $label) {
                if (! $request->hasFile($field)) {
                    continue;
                }
                $file = $request->file($field);
                if (! $file || ! $file->isValid()) {
                    continue;
                }
                $stored = $file->store("loan-applications/{$loan->id}/documents", 'public');
                $docs[] = [
                    'key' => $field,
                    'label' => $label,
                    'path' => $stored,
                    'original_name' => $file->getClientOriginalName(),
                    'mime' => $file->getClientMimeType(),
                ];
            }
            $loan->kyc_documents = $docs;
            $loan->save();
        }

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_SUBMITTED,
            'loan_submitted',
            'New loan application',
            'New application from '.$borrower->name.' — ₱'.number_format($loan->principal, 2),
            ['loan_id' => $loan->id],
            null,
            [
                'module' => NotificationCenter::MODULE_LOANS,
                'throttle_key' => 'loan_submitted:'.$loan->id,
                'throttle_max' => 1,
                'throttle_decay_seconds' => 120,
            ],
        );

        SendLoanApplicationReceivedJob::dispatch($borrower->id, $loan->id);

        return response()->json(['ok' => true, 'loan_id' => $loan->id], 201);
    }

    /**
     * Decision email to borrower for approved/rejected applications.
     * Failures are delegated to queue retry policies.
     */
    private function notifyBorrowerLoanDecision(Loan $loan): void
    {
        $loan->loadMissing(['borrower:id,name,email']);

        $decision = $loan->status === Loan::STATUS_REJECTED ? 'rejected' : 'approved';
        $ts = (int) ($loan->approved_at?->getTimestamp() ?? 0);
        $dedupeKey = SendLoanDecisionJob::dedupeKey($loan->id, $decision, $ts);

        $borrower = $loan->borrower;
        $email = trim((string) ($borrower?->email ?? ''));
        $validEmail = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);

        if (! $validEmail) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $loan->id,
                    'notification_type' => EmailLog::NOTIFICATION_LOAN_DECISION,
                    'mailable_class' => LoanDecisionMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower?->name,
                    'subject' => null,
                    'status' => EmailLog::STATUS_FAILED,
                    'transport_detail' => 'invalid_recipient',
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['source' => 'LoanController::notifyBorrowerLoanDecision'],
                ]
            );

            return;
        }

        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loan->id,
                'notification_type' => EmailLog::NOTIFICATION_LOAN_DECISION,
                'mailable_class' => LoanDecisionMail::class,
                'recipient_email' => $email,
                'recipient_name' => $borrower?->name,
                'subject' => null,
                'status' => EmailLog::STATUS_QUEUED,
                'transport_detail' => null,
                'error_message' => null,
                'meta' => ['source' => 'LoanController::notifyBorrowerLoanDecision'],
            ]
        );

        SendLoanDecisionJob::dispatch($loan->id, $decision, $ts);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function formatLoanDecisionEmailLog(?EmailLog $row): ?array
    {
        if (! $row) {
            return null;
        }

        return [
            'status' => $row->status,
            'recipient_email' => $row->recipient_email,
            'subject' => $row->subject,
            'transport_detail' => $row->transport_detail,
            'error_message' => $row->error_message,
            'sent_at' => $row->sent_at?->toIso8601String(),
            'created_at' => $row->created_at->toIso8601String(),
            'updated_at' => $row->updated_at->toIso8601String(),
        ];
    }

    /**
     * Underwriting: mark a {@see LoanDocument} row or an ad-hoc stored file path as verified / rejected / etc.
     */
    public function patchDocumentReview(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'loan_document_id' => 'nullable|integer|exists:loan_documents,id',
            'storage_path' => 'nullable|string|max:1024',
            'status' => 'required|string|in:pending,verified,rejected,requires_resubmission',
            'notes' => 'nullable|string|max:5000',
        ]);

        if (empty($data['loan_document_id']) && empty($data['storage_path'])) {
            return response()->json([
                'ok' => false,
                'message' => 'Provide loan_document_id or storage_path.',
            ], 422);
        }

        $loan->loadMissing(['loanApplication']);

        $notes = isset($data['notes']) ? trim((string) $data['notes']) : '';
        $status = $data['status'];
        $user = $request->user();

        if (! empty($data['loan_document_id'])) {
            $doc = LoanDocument::query()->whereKey((int) $data['loan_document_id'])->first();
            if (! $doc) {
                return response()->json(['ok' => false, 'message' => 'Document not found.'], 422);
            }
            $appId = $loan->loanApplication?->getKey();
            if (! $appId || (int) $doc->loan_application_id !== (int) $appId) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Document does not belong to this loan application.',
                ], 422);
            }

            DB::transaction(function () use ($loan, $doc, $status, $notes, $user, $logger): void {
                $doc->verification_status = $status;
                $doc->review_notes = $notes !== '' ? $notes : null;
                $doc->verified_by = $status === 'pending' ? null : $user->id;
                $doc->verified_at = $status === 'pending' ? null : now();
                $doc->save();

                $reviews = is_array($loan->document_reviews) ? $loan->document_reviews : [];
                $pathKey = (string) $doc->file_path;
                if ($pathKey !== '') {
                    $reviews[$pathKey] = [
                        'status' => $status,
                        'notes' => $notes !== '' ? $notes : null,
                        'reviewed_by' => $doc->verified_by,
                        'reviewed_at' => $doc->verified_at?->toIso8601String(),
                        'source' => 'loan_document',
                        'loan_document_id' => $doc->id,
                    ];
                    $loan->document_reviews = $reviews;
                    $loan->save();
                }

                $logger->log($user, 'loans.document_review', $loan, [
                    'loan_document_id' => $doc->id,
                    'status' => $status,
                ]);
            });
        } else {
            $path = trim((string) $data['storage_path']);
            if ($path === '') {
                return response()->json(['ok' => false, 'message' => 'Invalid storage path.'], 422);
            }

            $allowed = array_flip($this->collectLoanOwnedStoragePaths($loan));
            if (! isset($allowed[$path])) {
                return response()->json([
                    'ok' => false,
                    'message' => 'That file is not part of this loan.',
                ], 422);
            }

            DB::transaction(function () use ($loan, $path, $status, $notes, $user, $logger): void {
                $reviews = is_array($loan->document_reviews) ? $loan->document_reviews : [];
                $reviews[$path] = [
                    'status' => $status,
                    'notes' => $notes !== '' ? $notes : null,
                    'reviewed_by' => $status === 'pending' ? null : $user->id,
                    'reviewed_at' => $status === 'pending' ? null : now()->toIso8601String(),
                    'source' => 'storage_path',
                ];
                $loan->document_reviews = $reviews;
                $loan->save();

                $logger->log($user, 'loans.document_review', $loan, [
                    'storage_path' => $path,
                    'status' => $status,
                ]);
            });
        }

        $loan->refresh();
        $loan->load([
            'borrower',
            'approver',
            'payments',
            'receipts',
            'loanApplication.documents.verifiedBy',
            'loanApplication.coMaker',
            'loanApplication.travelLoanWizardForm',
            'loanApplication.dependents',
            'loanApplication.contactPersons',
            'loanApplication.creditMemorandum',
        ]);
        if ($loan->loanApplication) {
            $this->augmentLoanApplicationForAdminResponse($loan->loanApplication);
        }

        if ($loan->borrower && $status !== 'pending') {
            $docKey = ! empty($data['loan_document_id']) ? 'ld:'.(int) $data['loan_document_id'] : 'path:'.md5((string) ($data['storage_path'] ?? ''));
            $title = match ($status) {
                'verified' => 'Document verified',
                'rejected' => 'Document not accepted',
                'requires_resubmission' => 'Resubmit a document',
                default => 'Document review update',
            };
            $body = $notes !== '' ? $notes : 'Your loan #'.$loan->id.' has a document status update: '.$status.'.';
            app(NotificationCenter::class)->notifyBorrower(
                $loan->borrower,
                NotificationCenter::CATEGORY_DOCUMENT_REVIEW,
                'document_'.$status,
                $title,
                $body,
                ['loan_id' => $loan->id, 'status' => $status],
                [
                    'dedupe_key' => 'docreview:'.$loan->id.':'.$docKey.':'.$status,
                    'module' => NotificationCenter::MODULE_LOANS,
                    'priority' => $status === 'rejected' ? 4 : 3,
                ],
            );
        }

        return response()->json(['ok' => true, 'loan' => $loan]);
    }

    private function augmentLoanApplicationForAdminResponse(LoanApplication $app): void
    {
        $rawDocs = $app->getRawOriginal('documents');
        $payloadDocs = is_string($rawDocs) ? json_decode($rawDocs, true) : $rawDocs;
        $app->setAttribute('documents_payload', is_array($payloadDocs) ? $payloadDocs : []);

        $records = $app->relationLoaded('documents')
            ? $app->getRelation('documents')
            : $app->documents()->get();
        $app->setAttribute('documents_records', $records);
    }

    /**
     * @return array<int, string>
     */
    private function collectLoanOwnedStoragePaths(Loan $loan): array
    {
        $paths = [];
        $push = function (?string $p) use (&$paths): void {
            $p = $p !== null ? trim($p) : '';
            if ($p !== '') {
                $paths[$p] = true;
            }
        };

        $push($loan->face_photo_path);

        foreach ($loan->kyc_documents ?? [] as $doc) {
            if (is_array($doc)) {
                $push(isset($doc['path']) ? (string) $doc['path'] : null);
            }
        }

        $app = $loan->loanApplication;
        if ($app) {
            $push($app->applicant_signature);
            $push($app->spouse_signature);
            $push($app->comaker_signature);

            $walk = function ($node) use (&$walk, $push): void {
                if (is_string($node)) {
                    $push($node);
                } elseif (is_array($node)) {
                    foreach ($node as $v) {
                        $walk($v);
                    }
                }
            };

            $rawDocs = $app->getRawOriginal('documents');
            $payloadDocs = is_string($rawDocs) ? json_decode($rawDocs, true) : $rawDocs;
            $walk(is_array($payloadDocs) ? $payloadDocs : []);

            foreach (LoanDocument::query()->where('loan_application_id', $app->id)->cursor() as $row) {
                $push($row->file_path);
            }
        }

        return array_keys($paths);
    }

    public function assignOfficer(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'officer_id' => 'required|integer|exists:users,id',
        ]);

        $allowedRoleSlugs = ['super-admin', 'admin', 'admin-staff', 'collector', 'loan-officer'];
        $officer = User::query()
            ->whereKey($data['officer_id'])
            ->whereHas('roles', function ($q) use ($allowedRoleSlugs) {
                $q->whereIn('slug', $allowedRoleSlugs);
            })
            ->first();

        if (! $officer) {
            return response()->json([
                'ok' => false,
                'message' => 'Selected user must be Admin staff, Collector, or Loan Officer.',
            ], 422);
        }

        $loan->assigned_officer_id = $data['officer_id'];
        $loan->save();

        $logger->log($request->user(), 'loans.assign_officer', $loan, [
            'loan_id' => $loan->id,
            'officer_id' => $data['officer_id'],
        ]);

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_OFFICER_ASSIGNED,
            'loan_officer_assigned',
            'Loan officer assigned',
            $officer->name.' is now assigned to loan #'.$loan->id.'.',
            ['loan_id' => $loan->id, 'officer_id' => $officer->id],
            (int) $request->user()->id,
            ['module' => NotificationCenter::MODULE_LOANS],
        );

        return response()->json([
            'ok' => true,
            'loan' => $loan->fresh(['borrower', 'approver', 'assignedOfficer', 'payments']),
        ]);
    }

    private function resolveApprovalAnnualRate(Loan $loan): float
    {
        $stored = (float) $loan->annual_interest_rate;
        if ($stored > 0.0) {
            return $stored;
        }

        $payload = is_array($loan->application_payload) ? $loan->application_payload : [];
        $slugRaw = isset($payload['loan_product_slug']) ? trim((string) $payload['loan_product_slug']) : '';
        $slug = $slugRaw !== '' ? $slugRaw : null;

        if ($slug !== null) {
            $termMonths = max(1, (int) $loan->term_months);
            $fbMonthly = LoanProductRateResolver::fallbackMonthlyPercentForSlug($slug)
                ?? (((float) $this->defaultAnnualRate()) / 12.0);

            return $this->loanProductRates->resolveAnnualStoredPercent($slug, (float) $fbMonthly, $termMonths);
        }

        return (float) $this->defaultAnnualRate();
    }

    private function defaultAnnualRate(): float
    {
        $row = SystemSetting::where('key', 'loan_defaults')->first();
        $v = $row?->value;

        return isset($v['default_annual_rate']) ? (float) $v['default_annual_rate'] : 12.0;
    }
}
