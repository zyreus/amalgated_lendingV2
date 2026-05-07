<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\LoanListResource;
use App\Jobs\SendLoanApplicationReceivedJob;
use App\Jobs\SendLoanDecisionJob;
use App\Models\AdminNotification;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\LoanAmortizationService;
use App\Services\LoanProductRateResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class LoanController extends Controller
{
    public function __construct(
        private LoanAmortizationService $amortization,
        private LoanProductRateResolver $loanProductRates,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = Loan::query()
            ->select([
                'id',
                'borrower_id',
                'principal',
                'term_months',
                'annual_interest_rate',
                'application_payload',
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
            ->with([
                'borrower:id,name,email,phone',
                'approver:id,name,email',
                'assignedOfficer:id,name,email',
            ]);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($search = $request->query('search')) {
            $q->whereHas('borrower', function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%');
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
            'loanApplication.documents',
            'loanApplication.coMaker',
            'loanApplication.travelLoanWizardForm',
            'loanApplication.dependents',
            'loanApplication.contactPersons',
            'loanApplication.creditMemorandum',
        ]);

        return response()->json(['ok' => true, 'loan' => $loan]);
    }

    public function approve(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $request->validate(['admin_notes' => 'nullable|string']);

        if ($loan->status !== Loan::STATUS_PENDING) {
            return response()->json(['ok' => false, 'message' => 'Only pending loans can be approved.'], 422);
        }

        $rate = $this->resolveApprovalAnnualRate($loan);

        $result = DB::transaction(function () use ($request, $loan, $logger, $rate) {
            $schedule = $this->amortization->buildSchedule(
                (float) $loan->principal,
                $rate,
                (int) $loan->term_months
            );

            $loan->annual_interest_rate = $rate;
            $loan->status = Loan::STATUS_ONGOING;
            $loan->approved_by = $request->user()->id;
            $loan->approved_at = now();
            $loan->disbursed_at = now();
            $loan->monthly_payment = $schedule['monthly_payment'];
            $loan->total_interest = $schedule['total_interest'];
            $loan->outstanding_balance = (float) $loan->principal;
            $loan->schedule_json = $schedule['rows'];
            $loan->admin_notes = $request->input('admin_notes') ?? $loan->admin_notes;
            $loan->save();

            foreach ($schedule['rows'] as $row) {
                Payment::create([
                    'loan_id' => $loan->id,
                    'installment_no' => $row['installment_no'],
                    'due_date' => $row['due_date'],
                    'amount_due' => $row['payment'],
                    'principal_portion' => $row['principal'],
                    'interest_portion' => $row['interest'],
                    'status' => Payment::STATUS_PENDING,
                    'source' => 'system',
                ]);
            }

            $logger->log($request->user(), 'loans.approve', $loan, ['loan_id' => $loan->id]);

            return $loan->fresh(['payments']);
        });

        $result->loadMissing(['borrower', 'approver']);
        $this->notifyBorrowerLoanDecision($result);

        return response()->json(['ok' => true, 'loan' => $result]);
    }

    public function reject(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'rejection_reason' => 'required|string|max:2000',
        ]);

        if ($loan->status !== Loan::STATUS_PENDING) {
            return response()->json(['ok' => false, 'message' => 'Only pending loans can be rejected.'], 422);
        }

        $loan->status = Loan::STATUS_REJECTED;
        $loan->rejection_reason = $data['rejection_reason'];
        $loan->approved_by = $request->user()->id;
        $loan->approved_at = now();
        $loan->save();

        $logger->log($request->user(), 'loans.reject', $loan);

        $loan->loadMissing(['borrower', 'approver']);
        $this->notifyBorrowerLoanDecision($loan);

        return response()->json(['ok' => true, 'loan' => $loan]);
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

        AdminNotification::create([
            'user_id' => null,
            'type' => 'loan_submitted',
            'title' => 'New loan application',
            'body' => 'New application from '.$borrower->name.' — ₱'.number_format($loan->principal, 2),
            'data' => ['loan_id' => $loan->id],
        ]);

        SendLoanApplicationReceivedJob::dispatch($borrower->id, $loan->id);

        return response()->json(['ok' => true, 'loan_id' => $loan->id], 201);
    }

    /**
     * Decision email to borrower for approved/rejected applications.
     * Failures are delegated to queue retry policies.
     */
    private function notifyBorrowerLoanDecision(Loan $loan): void
    {
        SendLoanDecisionJob::dispatch($loan->id);
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
