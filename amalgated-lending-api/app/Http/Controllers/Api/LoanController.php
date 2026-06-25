<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LoanListResource;
use App\Jobs\SendLoanApplicationReceivedJob;
use App\Jobs\SendLoanDecisionJob;
use App\Jobs\SendLoanPreApprovedJob;
use App\Support\DeferredDispatch;
use App\Mail\LoanDecisionMail;
use App\Mail\LoanPreApprovedMail;
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
use App\Services\BorrowerLoanApplicationNotifier;
use App\Services\CreditWellnessService;
use App\Services\LoanAmountAdjustmentService;
use App\Services\LoanApplicationPortalPrintSections;
use App\Services\PropertyAppraisalService;
use App\Services\StaffScopeService;
use App\Services\LoanAmortizationService;
use App\Services\LoanCalculator;
use App\Services\LoanProductRateResolver;
use App\Services\NotificationCenter;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LoanController extends Controller
{
    public function __construct(
        private LoanCalculator $calculator,
        private LoanAmortizationService $amortization,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    private const APPLICATION_STATUSES = [
        Loan::STATUS_DRAFT,
        Loan::STATUS_PENDING_DOCUMENTS,
        Loan::STATUS_FOR_EVALUATION,
        Loan::STATUS_UNDER_REVIEW,
        Loan::STATUS_PENDING,
        Loan::STATUS_PARTIALLY_APPROVED,
        Loan::STATUS_PRE_APPROVED,
        Loan::STATUS_APPROVED,
        Loan::STATUS_RELEASED,
        Loan::STATUS_ONGOING,
        Loan::STATUS_REJECTED,
        Loan::STATUS_CANCELLED,
        Loan::STATUS_COMPLETED,
    ];

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
                'rejection_reason',
                'assigned_officer_id',
                'approved_by',
                'approved_at',
                'rejected_at',
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

        $status = $this->normalizeApplicationStatus($request->query('status'));
        if ($status !== null) {
            if ($status === Loan::STATUS_APPROVED) {
                $q->whereIn('status', [Loan::STATUS_APPROVED, Loan::STATUS_RELEASED, Loan::STATUS_ONGOING, 'ongoing']);
            } elseif ($status === Loan::STATUS_PARTIALLY_APPROVED || $status === Loan::STATUS_PRE_APPROVED) {
                $q->whereIn('status', [Loan::STATUS_PARTIALLY_APPROVED, 'pre-approved', Loan::STATUS_PRE_APPROVED]);
            } else {
                $q->where('status', $status);
            }
        }
        if ($search = $request->query('search')) {
            $search = trim((string) $search);
            $like = '%'.$search.'%';
            /** Subquery on `users` avoids correlated `whereHas` per loan row (better plan with `users.email` / name lookups). */
            $q->where(function ($where) use ($search, $like) {
                if (preg_match('/\d+/', $search, $m)) {
                    $where->orWhere('id', (int) $m[0]);
                }

                $where->orWhereIn('borrower_id', function ($sub) use ($like) {
                    $sub->select('id')
                        ->from('users')
                        ->where(function ($w) use ($like) {
                            $w->where('name', 'like', $like)
                                ->orWhere('email', 'like', $like);
                        });
                });
            });
        }

        $staffScope = app(StaffScopeService::class);
        $staffScope->applyAssignedLoanScope($q, $request->user());

        $loans = $q->orderByDesc('id')->paginate((int) $request->query('per_page', 15));

        $loans->setCollection(LoanListResource::collection($loans->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $loans]);
    }

    private function normalizeApplicationStatus(mixed $status): ?string
    {
        if ($status === null) {
            return null;
        }

        $value = Str::of((string) $status)->trim()->lower()->replace('_', '-')->toString();
        if ($value === '' || $value === 'all') {
            return null;
        }

        return Loan::normalizeStatus($value);
    }

    public function show(Request $request, Loan $loan): JsonResponse
    {
        $staffScope = app(StaffScopeService::class);
        if (! $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status)) {
            return response()->json(['ok' => false, 'message' => 'This loan is not assigned to you.'], 403);
        }

        $loan->load([
            'borrower',
            'approver',
            'preApprover',
            'releaser',
            'amountModifier',
            'payments',
            'receipts',
            'loanApplication.documents.uploadedBy',
            'loanApplication.coMakers.documents.uploadedBy',
            'loanApplication.coMaker',
            'loanApplication.realEstateDetail.evaluator',
            'loanApplication.chattelMortgageDetail',
            'loanApplication.salaryLoanDetail',
            'loanApplication.pensionLoanDetail',
            'loanApplication.travelAssistanceDetail',
            'loanApplication.travelLoanWizardForm',
            'loanApplication.dependents',
            'loanApplication.contactPersons',
            'loanApplication.creditMemorandum',
        ]);

        if ($loan->loanApplication) {
            $this->augmentLoanApplicationForAdminResponse($loan->loanApplication);
        }
        $this->augmentLoanStorageUrlsForAdminResponse($loan);

        $lastDecisionEmail = EmailLog::query()
            ->where('loan_id', $loan->id)
            ->where('notification_type', EmailLog::NOTIFICATION_LOAN_DECISION)
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'loan' => $loan,
            'document_permissions' => app(\App\Services\DocumentAccessService::class)->permissionsFor($request->user()),
            'last_loan_decision_email' => $this->formatLoanDecisionEmailLog($lastDecisionEmail),
        ]);
    }

    public function preApprove(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:5000',
            'approval_notes' => 'nullable|string|max:5000',
            'approved_principal' => 'nullable|numeric|min:0.01',
        ]);

        $previousApproved = round((float) ($loan->approved_principal ?? $loan->principal ?? 0), 2);

        $result = DB::transaction(function () use ($request, $loan, $logger) {
            $locked = Loan::query()
                ->whereKey($loan->getKey())
                ->lockForUpdate()
                ->with('loanApplication')
                ->firstOrFail();

            if ($locked->status !== Loan::STATUS_PENDING) {
                return response()->json(['ok' => false, 'message' => 'Only pending applications can be pre-approved.'], 422);
            }

            $locked->status = Loan::STATUS_PARTIALLY_APPROVED;
            $locked->pre_approved_by = $request->user()->id;
            $locked->pre_approved_at = now();
            $locked->rejected_at = null;
            $locked->rejection_reason = null;
            $notes = $request->input('approval_notes') ?? $request->input('admin_notes');
            $locked->approval_notes = $notes ?? $locked->approval_notes;
            $locked->admin_notes = $request->input('admin_notes') ?? $locked->admin_notes;

            if ($request->filled('approved_principal')) {
                $approvedAmount = round((float) $request->input('approved_principal'), 2);
                $requested = (float) ($locked->requested_principal ?? $locked->principal);
                $overrideCheck = $this->validateApprovedAmount($request, $approvedAmount, $requested);
                if ($overrideCheck instanceof JsonResponse) {
                    return $overrideCheck;
                }
                $locked->approved_principal = $approvedAmount;
                $locked->principal = $approvedAmount;
            }

            $history = is_array($locked->approval_history) ? $locked->approval_history : [];
            $history[] = [
                'event' => 'partially_approved',
                'at' => now()->toIso8601String(),
                'user_id' => $request->user()->id,
                'approved_principal' => $locked->approved_principal,
                'notes' => $notes,
            ];
            $locked->approval_history = $history;
            $locked->save();

            if ($locked->loanApplication) {
                $locked->loanApplication->status = LoanApplication::STATUS_PARTIALLY_APPROVED;
                $locked->loanApplication->verified_at = now();
                $locked->loanApplication->rejection_reason = null;
                $locked->loanApplication->save();
            }

            $logger->log($request->user(), 'loans.pre_approve', $locked, ['loan_id' => $locked->id]);

            return $locked->fresh(['borrower', 'approver', 'loanApplication']);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $result->loadMissing(['borrower', 'approver']);
        $this->notifyBorrowerPreApproved($result);

        $newApproved = round((float) ($result->approved_principal ?? $result->principal), 2);
        if ($request->filled('approved_principal')) {
            app(BorrowerLoanApplicationNotifier::class)->notifyApprovedAmountChanged(
                $result,
                $request->user(),
                $previousApproved,
                $newApproved,
                $result->approval_notes,
            );
        }

        $ts = (int) ($result->approved_at?->getTimestamp() ?? now()->getTimestamp());
        $nc = app(NotificationCenter::class);
        if ($result->borrower) {
            $requested = $result->requested_principal ?? $result->loanApplication?->loan_amount;
            $amountLine = $requested !== null
                ? ' Requested: ₱'.number_format((float) $requested, 2).'. Approved: ₱'.number_format($newApproved, 2).'.'
                : '';
            $nc->notifyBorrower(
                $result->borrower,
                NotificationCenter::CATEGORY_LOAN_PRE_APPROVED,
                'loan_pre_approved',
                'Application pre-approved',
                'Your loan application #'.$result->id.' is partially approved.'.$amountLine.' Please wait for final approval.',
                ['loan_id' => $result->id],
                ['dedupe_key' => 'loan_pre_approved:'.$result->id.':'.$ts, 'module' => NotificationCenter::MODULE_LOANS],
            );
        }
        $nc->notifyStaff(
            NotificationCenter::CATEGORY_LOAN_PRE_APPROVED,
            'loan_pre_approved',
            'Application pre-approved',
            'Loan #'.$result->id.($result->borrower ? ' — '.$result->borrower->name : '').' was pre-approved.',
            ['loan_id' => $result->id],
            (int) $request->user()->id,
            ['module' => NotificationCenter::MODULE_LOANS],
        );

        $lastPreApprovalEmail = EmailLog::query()
            ->where('loan_id', $result->id)
            ->where('notification_type', EmailLog::NOTIFICATION_LOAN_PRE_APPROVED)
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'loan' => $result,
            'last_loan_pre_approval_email' => $this->formatLoanDecisionEmailLog($lastPreApprovalEmail),
            'email_notification_queued' => true,
        ]);
    }

    public function returnToPending(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:5000',
        ]);

        $result = DB::transaction(function () use ($request, $loan, $logger) {
            $locked = Loan::query()
                ->whereKey($loan->getKey())
                ->lockForUpdate()
                ->with('loanApplication')
                ->firstOrFail();

            if ($locked->status !== Loan::STATUS_PARTIALLY_APPROVED && $locked->status !== Loan::STATUS_PRE_APPROVED && $locked->status !== 'pre-approved') {
                return response()->json(['ok' => false, 'message' => 'Only partially approved applications can return to pending.'], 422);
            }

            $locked->status = Loan::STATUS_PENDING;
            $locked->pre_approved_by = null;
            $locked->pre_approved_at = null;
            $locked->approved_principal = null;
            $locked->admin_notes = $request->input('admin_notes') ?? $locked->admin_notes;
            $locked->save();

            if ($locked->loanApplication) {
                $locked->loanApplication->status = LoanApplication::STATUS_PENDING;
                $locked->loanApplication->verified_at = null;
                $locked->loanApplication->save();
            }

            $logger->log($request->user(), 'loans.return_to_pending', $locked, ['loan_id' => $locked->id]);

            return $locked->fresh(['borrower', 'approver', 'loanApplication']);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        return response()->json(['ok' => true, 'loan' => $result]);
    }

    public function approve(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:5000',
            'approval_notes' => 'nullable|string|max:5000',
            'approved_principal' => 'sometimes|numeric|min:0.01',
            'term_months' => 'sometimes|integer|min:1|max:600',
            'monthly_rate_percent' => 'sometimes|numeric|min:0|max:100',
            'force_amount_override' => 'sometimes|boolean',
        ]);

        $approvableStatuses = [
            Loan::STATUS_PENDING,
            Loan::STATUS_PARTIALLY_APPROVED,
            Loan::STATUS_PRE_APPROVED,
            'pre-approved',
            Loan::STATUS_FOR_EVALUATION,
            Loan::STATUS_UNDER_REVIEW,
        ];
        if (! in_array($loan->status, $approvableStatuses, true)) {
            return response()->json(['ok' => false, 'message' => 'Only pending or partially approved applications can be approved.'], 422);
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

            $approvable = [
                Loan::STATUS_PENDING,
                Loan::STATUS_PARTIALLY_APPROVED,
                Loan::STATUS_PRE_APPROVED,
                'pre-approved',
                Loan::STATUS_FOR_EVALUATION,
                Loan::STATUS_UNDER_REVIEW,
            ];
            if (! in_array($loan->status, $approvable, true)) {
                return response()->json(['ok' => false, 'message' => 'Only pending or partially approved applications can be approved.'], 422);
            }

            if ($loanApp = $loan->loanApplication) {
                if ($loanApp->loan_amount !== null && $loan->requested_principal === null) {
                    $loan->requested_principal = round((float) $loanApp->loan_amount, 2);
                }
            } elseif ($loan->requested_principal === null) {
                $loan->requested_principal = round((float) $loan->principal, 2);
            }

            $principal = (float) ($loan->approved_principal ?? $loan->principal);
            if ($request->filled('approved_principal')) {
                $principal = round((float) $request->input('approved_principal'), 2);
            }

            $requested = (float) ($loan->requested_principal ?? $loan->principal);
            $overrideCheck = $this->validateApprovedAmount($request, $principal, $requested);
            if ($overrideCheck instanceof JsonResponse) {
                return $overrideCheck;
            }

            $loan->approved_principal = $principal;
            $loan->principal = $principal;
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
            $loan->status = Loan::STATUS_RELEASED;
            $loan->approved_by = $request->user()->id;
            $loan->approved_at = now();
            $loan->released_by = $request->user()->id;
            $loan->rejected_at = null;
            $loan->disbursed_at = now();
            $approvalNotes = $request->input('approval_notes') ?? $request->input('admin_notes');
            $loan->approval_notes = $approvalNotes ?? $loan->approval_notes;
            $loan->admin_notes = $request->input('admin_notes') ?? $loan->admin_notes;
            $loan->monthly_payment = isset($breakdown['monthly_amortization']) ? (float) $breakdown['monthly_amortization'] : $loan->monthly_payment;
            $loan->total_interest = isset($breakdown['total_add_on_interest']) ? (float) $breakdown['total_add_on_interest'] : $loan->total_interest;
            $loan->schedule_json = $schedule;
            $loan->outstanding_balance = round((float) array_sum(array_map(fn ($r) => (float) ($r['payment'] ?? 0), $schedule)), 2);

            $history = is_array($loan->approval_history) ? $loan->approval_history : [];
            $history[] = [
                'event' => 'approved_and_released',
                'at' => now()->toIso8601String(),
                'user_id' => $request->user()->id,
                'requested_principal' => $loan->requested_principal,
                'approved_principal' => $loan->approved_principal,
                'notes' => $approvalNotes,
            ];
            $loan->approval_history = $history;

            $loanApp = $loan->loanApplication;

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
                $loanApp->approved_amount = round((float) $loan->approved_principal, 2);
                $loanApp->save();
            }

            // Rebuild payment ledger from official schedule.
            $termMonths = max(1, (int) $loan->term_months);
            Payment::query()->where('loan_id', $loan->id)->delete();
            $now = now();
            $paymentRows = [];
            foreach ($schedule as $row) {
                $instNo = (int) ($row['installment_no'] ?? 0);
                $paymentRows[] = [
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
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
            if ($paymentRows !== []) {
                Payment::query()->insert($paymentRows);
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
        if ($result->borrower) {
            app(CreditWellnessService::class)->recalculateForUser($result->borrower, notify: false);
        }

        $nc = app(NotificationCenter::class);
        if ($result->borrower) {
            $requested = $result->requested_principal ?? $result->loanApplication?->loan_amount;
            $approved = $result->approved_principal ?? $result->principal;
            $amountLine = '';
            if ($requested !== null || $approved !== null) {
                $amountLine = ' Requested: ₱'.number_format((float) ($requested ?? $approved), 2)
                    .'. Approved: ₱'.number_format((float) $approved, 2).'.';
            }
            $nc->notifyBorrower(
                $result->borrower,
                NotificationCenter::CATEGORY_LOAN_APPROVED,
                'loan_approved',
                'Loan approved',
                'Your loan #'.$result->id.' was approved.'.$amountLine.' Your repayment schedule is ready in the borrower portal.',
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

            if (! in_array($locked->status, [Loan::STATUS_PENDING, Loan::STATUS_PRE_APPROVED], true)) {
                return response()->json(['ok' => false, 'message' => 'Only pending or pre-approved applications can be rejected.'], 422);
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

            $borrower = User::query()
                ->whereKey($locked->borrower_id)
                ->lockForUpdate()
                ->first();

            if ($borrower && ! $borrower->is_archived && ! $borrower->canAccessAdminPortal()) {
                $borrower->forceFill([
                    'is_archived' => true,
                    'archived_at' => now(),
                    'archive_reason' => 'Application Rejected',
                    'deleted_at' => null,
                    'archived_by' => $request->user()->id,
                    'restored_by' => null,
                    'deleted_by' => null,
                ])->save();

                $logger->log($request->user(), 'borrowers.archive', $borrower, [
                    'reason' => 'Application Rejected',
                    'loan_id' => $locked->id,
                    'borrower_id' => $borrower->id,
                ]);
            }

            return $locked->fresh(['borrower', 'approver', 'loanApplication']);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $this->notifyBorrowerLoanDecision($result);
        if ($result->borrower) {
            app(CreditWellnessService::class)->recalculateForUser($result->borrower, notify: false);
        }

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
            'requested_principal' => $data['principal'],
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

        DeferredDispatch::run(new SendLoanApplicationReceivedJob($borrower->id, $loan->id));

        return response()->json(['ok' => true, 'loan_id' => $loan->id], 201);
    }

    /**
     * Pre-approval email to borrower (portal notice is sent separately via NotificationCenter).
     */
    private function notifyBorrowerPreApproved(Loan $loan): void
    {
        $loan->loadMissing(['borrower:id,name,email']);

        $ts = (int) ($loan->approved_at?->getTimestamp()
            ?? $loan->updated_at?->getTimestamp()
            ?? now()->getTimestamp());
        $dedupeKey = SendLoanPreApprovedJob::dedupeKey($loan->id, $ts);

        $borrower = $loan->borrower;
        $email = trim((string) ($borrower?->email ?? ''));
        $validEmail = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);

        if (! $validEmail) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $loan->id,
                    'notification_type' => EmailLog::NOTIFICATION_LOAN_PRE_APPROVED,
                    'mailable_class' => LoanPreApprovedMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower?->name,
                    'subject' => null,
                    'status' => EmailLog::STATUS_FAILED,
                    'transport_detail' => 'invalid_recipient',
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['source' => 'LoanController::notifyBorrowerPreApproved'],
                ]
            );

            return;
        }

        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loan->id,
                'notification_type' => EmailLog::NOTIFICATION_LOAN_PRE_APPROVED,
                'mailable_class' => LoanPreApprovedMail::class,
                'recipient_email' => $email,
                'recipient_name' => $borrower?->name,
                'subject' => null,
                'status' => EmailLog::STATUS_QUEUED,
                'transport_detail' => null,
                'error_message' => null,
                'meta' => ['source' => 'LoanController::notifyBorrowerPreApproved'],
            ]
        );

        DeferredDispatch::run(new SendLoanPreApprovedJob($loan->id, $ts));
    }

    /**
     * Decision email to borrower for approved/rejected applications.
     * Failures are delegated to queue retry policies.
     */
    private function notifyBorrowerLoanDecision(Loan $loan): void
    {
        $loan->loadMissing(['borrower:id,name,email']);

        $decision = $loan->status === Loan::STATUS_REJECTED ? 'rejected' : 'approved';
        $ts = (int) ($loan->approved_at?->getTimestamp()
            ?? $loan->rejected_at?->getTimestamp()
            ?? $loan->updated_at?->getTimestamp()
            ?? now()->getTimestamp());
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

        DeferredDispatch::run(new SendLoanDecisionJob($loan->id, $decision, $ts));
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
        if ($status === 'requires_resubmission') {
            $docLabel = 'Document';
            if (! empty($data['loan_document_id'])) {
                $doc = LoanDocument::query()->find((int) $data['loan_document_id']);
                $docLabel = $doc?->document_type ?: ($doc?->original_name ?: 'Document');
            }
            app(BorrowerLoanApplicationNotifier::class)->notifyDocumentResubmissionRequired(
                $loan,
                $user,
                (string) $docLabel,
                $notes !== '' ? $notes : null,
            );
        }
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
        $this->augmentLoanStorageUrlsForAdminResponse($loan);

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
        $payloadDocs = is_array($payloadDocs) ? $payloadDocs : [];
        $app->setAttribute('documents_payload', $payloadDocs);
        $app->setAttribute('documents_payload_urls', $this->mapDocumentPathsToUrls($payloadDocs));

        $records = $app->relationLoaded('documents')
            ? $app->getRelation('documents')
            : $app->documents()->get();
        $app->setAttribute('documents_records', $records->map(function (LoanDocument $doc) {
            $row = $doc->toArray();
            $row['file_url'] = PublicStorageUrl::apiUrl($doc->file_path);

            return $row;
        })->values());

        $form = is_array($app->form_data) ? $app->form_data : [];
        $app->setAttribute(
            'portal_review_sections',
            app(LoanApplicationPortalPrintSections::class)->build($app, $form),
        );
    }

    /**
     * @param  array<string, mixed>  $payloadDocs
     * @return array<string, mixed>
     */
    private function mapDocumentPathsToUrls(array $payloadDocs): array
    {
        $out = [];
        foreach ($payloadDocs as $key => $value) {
            if (is_string($value) && $value !== '') {
                $out[$key] = PublicStorageUrl::apiUrl($value);
            } elseif (is_array($value)) {
                $urls = [];
                foreach ($value as $path) {
                    if (is_string($path) && $path !== '') {
                        $urls[] = PublicStorageUrl::apiUrl($path);
                    }
                }
                $out[$key] = $urls;
            }
        }

        return $out;
    }

    private function augmentLoanStorageUrlsForAdminResponse(Loan $loan): void
    {
        $loan->setAttribute('face_photo_url', PublicStorageUrl::apiUrl($loan->face_photo_path));

        $kyc = [];
        foreach ($loan->kyc_documents ?? [] as $idx => $doc) {
            if (! is_array($doc)) {
                continue;
            }
            $path = isset($doc['path']) ? (string) $doc['path'] : '';
            $kyc[] = array_merge($doc, [
                'url' => $path !== '' ? PublicStorageUrl::apiUrl($path) : null,
            ]);
        }
        $loan->setAttribute('kyc_documents_with_urls', $kyc);

        $app = $loan->loanApplication;
        if ($app) {
            $app->setAttribute('applicant_signature_url', PublicStorageUrl::apiUrl($app->applicant_signature));
            $app->setAttribute('spouse_signature_url', PublicStorageUrl::apiUrl($app->spouse_signature));
            $app->setAttribute('comaker_signature_url', PublicStorageUrl::apiUrl($app->comaker_signature));
        }
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

    /**
     * Set confirmed loan amount on an application (shown to borrower after review).
     */
    public function updateApplicationLoanAmount(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        if (! $this->canEditLoanAmount($request->user())) {
            return response()->json(['ok' => false, 'message' => 'You do not have permission to edit loan amounts.'], 403);
        }

        $staffScope = app(StaffScopeService::class);
        if (! $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status)) {
            return response()->json(['ok' => false, 'message' => 'This loan is not assigned to you.'], 403);
        }

        $request->validate([
            'loan_amount' => 'required|numeric|min:0.01',
        ]);

        if (in_array($loan->status, [Loan::STATUS_REJECTED, Loan::STATUS_CANCELLED, Loan::STATUS_COMPLETED], true)) {
            return response()->json(['ok' => false, 'message' => 'Loan amount cannot be changed for this loan status.'], 422);
        }

        $loan->loadMissing('loanApplication.loanProduct');
        $app = $loan->loanApplication;
        if (! $app) {
            return response()->json(['ok' => false, 'message' => 'No linked loan application found.'], 422);
        }

        $newAmount = round((float) $request->input('loan_amount'), 2);
        $previous = $app->loan_amount !== null ? round((float) $app->loan_amount, 2) : null;

        DB::transaction(function () use ($loan, $app, $newAmount) {
            $app->loan_amount = $newAmount;
            $this->recomputeApplicationLoanAmount($app);
            $app->save();

            if ($loan->requested_principal === null || (float) $loan->requested_principal <= 0) {
                $loan->requested_principal = $newAmount;
            }
            $loan->save();
        });

        $actor = $request->user();
        $logger->log($actor, 'loans.application_loan_amount_changed', $loan->fresh(['loanApplication']), [
            'loan_id' => $loan->id,
            'loan_application_id' => $app->id,
            'previous_amount' => $previous,
            'new_amount' => $newAmount,
            'message' => sprintf(
                '%s %s set proposed chattel loan amount to ₱%s.',
                $this->staffRoleLabel($actor),
                $actor->name,
                number_format($newAmount, 2),
            ),
        ], 'loans', $loan->id);

        return response()->json([
            'ok' => true,
            'loan' => $loan->fresh(['loanApplication', 'loanApplication.loanProduct']),
        ]);
    }

    /**
     * Update approved/adjusted loan amount during evaluation or after release (staff only).
     */
    public function updateApprovedAmount(Request $request, Loan $loan, ActivityLogger $logger, LoanAmountAdjustmentService $amountService): JsonResponse
    {
        if (! $this->canEditLoanAmount($request->user())) {
            return response()->json(['ok' => false, 'message' => 'You do not have permission to edit loan amounts.'], 403);
        }

        $staffScope = app(StaffScopeService::class);
        if (! $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status)) {
            return response()->json(['ok' => false, 'message' => 'This loan is not assigned to you.'], 403);
        }

        $request->validate([
            'approved_principal' => 'required|numeric|min:0.01',
            'approval_notes' => 'nullable|string|max:5000',
            'force_amount_override' => 'sometimes|boolean',
        ]);

        if ($loan->status === Loan::STATUS_REJECTED || $loan->status === Loan::STATUS_CANCELLED || $loan->status === Loan::STATUS_COMPLETED) {
            return response()->json(['ok' => false, 'message' => 'Loan amount cannot be changed for this loan status.'], 422);
        }

        $approvedAmount = round((float) $request->input('approved_principal'), 2);
        $requested = (float) ($loan->requested_principal ?? $loan->principal);
        $overrideCheck = $this->validateApprovedAmount($request, $approvedAmount, $requested);
        if ($overrideCheck instanceof JsonResponse) {
            return $overrideCheck;
        }

        $result = $amountService->adjustApprovedAmount(
            $loan,
            $request->user(),
            $approvedAmount,
            $request->input('approval_notes'),
        );

        $previous = $result['previous_amount'];
        $actor = $request->user();
        $message = sprintf(
            '%s %s changed Loan Amount from ₱%s to ₱%s.',
            $this->staffRoleLabel($actor),
            $actor->name,
            number_format($previous, 2),
            number_format($approvedAmount, 2),
        );

        $logger->log($request->user(), 'loans.loan_amount_changed', $result['loan'], [
            'loan_id' => $loan->id,
            'message' => $message,
            'old_amount' => $previous,
            'new_amount' => $approvedAmount,
            'ledger_rebuilt' => $result['ledger_rebuilt'],
            'borrower_notified_in_app' => (bool) ($result['borrower_notification']['in_app'] ?? false),
            'borrower_notified_email' => (bool) ($result['borrower_notification']['email_queued'] ?? false),
            'notification_skipped' => (bool) ($result['borrower_notification']['skipped'] ?? false),
            'notification_dedupe_key' => $result['borrower_notification']['dedupe_key'] ?? null,
        ], 'loans', $loan->id);

        if ($result['loan']->borrower) {
            app(CreditWellnessService::class)->recalculateForUser($result['loan']->borrower, notify: false);
        }

        return response()->json([
            'ok' => true,
            'loan' => $result['loan'],
            'ledger_rebuilt' => $result['ledger_rebuilt'],
            'audit_message' => $message,
        ]);
    }

    /**
     * Staff property appraisal / evaluation for real estate mortgage loans.
     */
    public function updatePropertyAppraisal(Request $request, Loan $loan, ActivityLogger $logger, PropertyAppraisalService $appraisalService): JsonResponse
    {
        if (! $this->canEditPropertyAppraisal($request->user())) {
            return response()->json(['ok' => false, 'message' => 'You do not have permission to update property appraisal.'], 403);
        }

        $staffScope = app(StaffScopeService::class);
        if (! $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status)) {
            return response()->json(['ok' => false, 'message' => 'This loan is not assigned to you.'], 403);
        }

        $app = $loan->loanApplication;
        if (! $app || $app->loan_type !== LoanApplication::TYPE_REAL_ESTATE) {
            return response()->json(['ok' => false, 'message' => 'Property appraisal applies only to real estate mortgage loans.'], 422);
        }

        $data = $request->validate([
            'property_type' => 'nullable|string|max:120',
            'title_number' => 'nullable|string|max:255',
            'tax_declaration_number' => 'nullable|string|max:255',
            'property_address' => 'nullable|string|max:5000',
            'lot_area' => 'nullable|numeric|min:0',
            'floor_area' => 'nullable|numeric|min:0',
            'market_value' => 'nullable|numeric|min:0',
            'assessed_value' => 'nullable|numeric|min:0',
            'appraised_value' => 'nullable|numeric|min:0',
            'loanable_percentage' => 'nullable|numeric|min:0|max:100',
            'loanable_value' => 'nullable|numeric|min:0',
            'evaluation_remarks' => 'nullable|string|max:10000',
        ]);

        $previous = $app->realEstateDetail?->only([
            'market_value',
            'appraised_value',
            'loanable_value',
            'loanable_percentage',
        ]) ?? [];

        $result = $appraisalService->updateFromStaff($loan, $request->user(), $data);
        $detail = $result['detail'];

        $loan->load([
            'borrower',
            'loanApplication.realEstateDetail.evaluator',
        ]);
        if ($loan->loanApplication) {
            $this->augmentLoanApplicationForAdminResponse($loan->loanApplication);
        }

        $logger->log($request->user(), 'loans.property_appraisal_updated', $loan, [
            'loan_id' => $loan->id,
            'previous' => $previous,
            'current' => $detail->only([
                'market_value',
                'appraised_value',
                'loanable_value',
                'loanable_percentage',
                'evaluated_at',
            ]),
        ], 'loans', $loan->id);

        $evaluationNotify = app(BorrowerLoanApplicationNotifier::class)->notifyEvaluationUpdated(
            $loan->fresh(['borrower', 'loanApplication']),
            $request->user(),
            $data['evaluation_remarks'] ?? null,
        );
        if ($evaluationNotify['email_queued'] ?? false) {
            $logger->log($request->user(), 'loans.borrower_evaluation_notified', $loan, [
                'loan_id' => $loan->id,
                'in_app' => $evaluationNotify['in_app'] ?? false,
                'email_queued' => $evaluationNotify['email_queued'] ?? false,
            ], 'loans', $loan->id);
        }

        return response()->json([
            'ok' => true,
            'loan' => $loan,
            'real_estate_detail' => $detail,
        ]);
    }

    private function recomputeApplicationLoanAmount(LoanApplication $app): void
    {
        if (! $app->loan_product_id) {
            $app->computed_values = null;
            $app->computation_breakdown = null;

            return;
        }

        $form = is_array($app->form_data) ? $app->form_data : [];
        $termMonths = (int) ($app->term_months ?? $form['term_months'] ?? 0);
        $loanAmount = (float) ($app->loan_amount ?? 0);
        if ($termMonths <= 0 || $loanAmount <= 0) {
            $app->computed_values = null;
            $app->computation_breakdown = null;

            return;
        }

        $nature = (string) ($form['application_nature'] ?? 'new');

        try {
            $compute = $this->calculator->compute([
                'product_id' => (int) $app->loan_product_id,
                'loan_amount' => $loanAmount,
                'term_months' => $termMonths,
                'application_nature' => $nature,
            ]);
            $app->computed_values = [
                'monthly_rate_percent_effective' => $compute['product']['monthly_rate_percent_effective'] ?? null,
                'monthly_amortization' => $compute['breakdown']['monthly_amortization'] ?? null,
                'net_proceeds' => $compute['breakdown']['net_proceeds'] ?? null,
                'estimated_loanable_amount' => $loanAmount,
            ];
            $app->computation_breakdown = $compute;
        } catch (ValidationException) {
            $app->computed_values = null;
            $app->computation_breakdown = null;
        }
    }

    private function canEditPropertyAppraisal(User $user): bool
    {
        if ($user->roles()->where('slug', 'super-admin')->exists()) {
            return true;
        }

        return $user->hasPermission('loans.edit_amount') || $user->hasPermission('loans.approve');
    }

    private function canEditLoanAmount(User $user): bool
    {
        if ($user->roles()->where('slug', 'super-admin')->exists()) {
            return true;
        }

        return $user->hasPermission('loans.edit_amount') || $user->hasPermission('loans.approve');
    }

    private function staffRoleLabel(User $user): string
    {
        $user->loadMissing('roles');
        $slug = strtolower((string) ($user->roles->first()?->slug ?? ''));
        if (str_contains($slug, 'officer')) {
            return 'Loan Officer';
        }
        if ($slug === 'super-admin') {
            return 'Super Admin';
        }
        if (str_contains($slug, 'admin') || str_contains($slug, 'manager')) {
            return 'Admin';
        }

        return 'Staff';
    }

    private function validateApprovedAmount(Request $request, float $approvedAmount, float $requestedAmount): ?JsonResponse
    {
        if ($requestedAmount <= 0) {
            return null;
        }

        if ($approvedAmount <= $requestedAmount) {
            return null;
        }

        $canOverride = $request->boolean('force_amount_override')
            && ($request->user()->hasPermission('loans.approve_amount_override')
                || $request->user()->roles()->where('slug', 'super-admin')->exists());

        if ($canOverride) {
            return null;
        }

        return response()->json([
            'ok' => false,
            'message' => 'Approved amount exceeds requested amount. Super Admin override required.',
            'warning' => 'amount_exceeds_requested',
            'requested_principal' => round($requestedAmount, 2),
            'approved_principal' => round($approvedAmount, 2),
        ], 422);
    }

    private function defaultAnnualRate(): float
    {
        $row = SystemSetting::where('key', 'loan_defaults')->first();
        $v = $row?->value;

        return isset($v['default_annual_rate']) ? (float) $v['default_annual_rate'] : 12.0;
    }
}
