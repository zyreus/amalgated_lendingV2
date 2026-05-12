<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentListResource;
use App\Jobs\SendPaymentReceiptJob;
use App\Mail\PaymentReceiptMail;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\PaymentAdjustmentAudit;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CreditScoreService;
use App\Services\FinalPaymentAdjustmentService;
use App\Services\LoanPaymentBalanceService;
use App\Services\NotificationCenter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function __construct(
        private LoanPaymentBalanceService $loanPaymentBalances,
        private FinalPaymentAdjustmentService $finalPaymentAdjustments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = Payment::query()
            ->with([
                'loan' => fn ($rel) => $rel->select([
                    'id', 'borrower_id', 'term_months', 'outstanding_balance', 'status', 'principal',
                ]),
                'loan.borrower:id,name,email',
                'confirmedByUser:id,name',
            ]);

        if ($request->filled('loan_id')) {
            $q->where('loan_id', $request->query('loan_id'));
        }
        if ($request->filled('loan_search')) {
            $loanId = $this->parseLoanSearchToId((string) $request->query('loan_search'));
            if ($loanId !== null) {
                $q->where('loan_id', $loanId);
            }
        }
        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($request->filled('overdue')) {
            $q->where('status', '!=', Payment::STATUS_PAID)
                ->whereDate('due_date', '<', now()->toDateString());
        }

        $rows = $q->orderByDesc('due_date')->paginate((int) $request->query('per_page', 20));

        $statusMap = $this->receiptEmailStatusMapForPaymentIds($rows->getCollection()->pluck('id'));
        $rows->getCollection()->each(function (Payment $p) use ($statusMap): void {
            $p->setAttribute('_receipt_email_status', $statusMap[(int) $p->getKey()] ?? null);
        });

        $rows->setCollection(PaymentListResource::collection($rows->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function forUser(Request $request, User $user): JsonResponse
    {
        $loanIds = Loan::query()->where('borrower_id', $user->id)->pluck('id');
        $payments = Payment::query()
            ->whereIn('loan_id', $loanIds)
            ->with([
                'loan' => fn ($rel) => $rel->select([
                    'id', 'borrower_id', 'term_months', 'outstanding_balance', 'status', 'principal',
                ]),
                'loan.borrower:id,name,email',
            ])
            ->orderByDesc('due_date')
            ->paginate((int) $request->query('per_page', 15));

        return response()->json(['ok' => true, 'data' => $payments]);
    }

    public function record(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'amount_paid' => 'required|numeric|min:0',
            'paid_at' => 'nullable|date',
            'source' => 'nullable|string|in:manual,api',
            'external_ref' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $ext = isset($data['external_ref']) ? trim((string) $data['external_ref']) : '';
        if ($ext !== '') {
            $dup = Payment::query()
                ->where('loan_id', $payment->loan_id)
                ->whereKeyNot($payment->id)
                ->where('external_ref', $ext)
                ->where('status', Payment::STATUS_PAID)
                ->exists();
            if ($dup) {
                return response()->json([
                    'ok' => false,
                    'message' => 'This external reference is already recorded as paid on another installment for this loan.',
                ], 422);
            }
        }

        $becamePaid = false;
        $freshPayment = null;

        DB::transaction(function () use ($request, $payment, $data, &$becamePaid, &$freshPayment): void {
            $p = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
            $previousStatus = $p->status;

            $p->amount_paid = $data['amount_paid'];
            $p->paid_at = isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now();
            $p->source = $data['source'] ?? 'manual';
            if (isset($data['external_ref'])) {
                $p->external_ref = $data['external_ref'];
            }
            if (isset($data['notes'])) {
                $p->notes = $data['notes'];
            }

            if ($p->amount_paid >= $p->amount_due - 0.01) {
                $p->status = Payment::STATUS_PAID;
            } elseif ($p->amount_paid > 0) {
                $p->status = Payment::STATUS_PARTIAL;
            }

            if ($p->status !== Payment::STATUS_PAID && $p->due_date->isPast()) {
                $p->status = Payment::STATUS_OVERDUE;
            }

            if ($this->paymentJustBecamePaid($previousStatus, $p->status)) {
                if (empty($p->official_receipt_number)) {
                    $p->official_receipt_number = $this->mintOfficialReceiptNumber($p);
                }
                $p->confirmed_by = $request->user()->id;
                $p->confirmation_date = now();
            }

            $p->save();
            $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
            $freshPayment = $p->fresh(['loan.borrower', 'confirmedByUser']);
            $becamePaid = $this->paymentJustBecamePaid($previousStatus, $p->status);
        });

        if ($freshPayment?->loan?->borrower) {
            $borrowerIdForScore = (int) $freshPayment->loan->borrower_id;
            dispatch(function () use ($borrowerIdForScore): void {
                try {
                    $b = User::query()->find($borrowerIdForScore);
                    if ($b) {
                        app(CreditScoreService::class)->recalculateForUser($b);
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            })->afterResponse();
        }

        $logger->log($request->user(), 'payments.record', $freshPayment ?? $payment);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($becamePaid && $freshPayment) {
            $this->queuePaymentReceiptEmail($freshPayment, $request->user());
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
        }

        $lastReceiptEmail = null;
        if ($freshPayment && trim((string) ($freshPayment->official_receipt_number ?? '')) !== '') {
            $lastReceiptEmail = EmailLog::query()
                ->where('dedupe_key', SendPaymentReceiptJob::dedupeKey($freshPayment->id, (string) $freshPayment->official_receipt_number))
                ->first();
        }

        $outPayment = $freshPayment ?? $payment;
        $outPayment->loadMissing(['loan.borrower', 'confirmedByUser']);

        return response()->json([
            'ok' => true,
            'payment' => $outPayment,
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
            'last_payment_receipt_email' => $this->formatPaymentReceiptEmailLog($lastReceiptEmail),
        ]);
    }

    public function updateStatus(Request $request, Payment $payment, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|string|in:pending,paid',
        ]);

        $becamePaid = false;
        $freshPayment = null;

        DB::transaction(function () use ($request, $payment, $data, &$becamePaid, &$freshPayment): void {
            $p = Payment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();
            $previousStatus = $p->status;

            if ($data['status'] === Payment::STATUS_PAID) {
                if ($p->status === Payment::STATUS_PAID) {
                    $freshPayment = $p->fresh(['loan.borrower', 'confirmedByUser']);

                    return;
                }
                $p->status = Payment::STATUS_PAID;
                $p->amount_paid = $p->amount_due;
                $p->paid_at = now();
                $p->source = $p->source ?: 'manual';
                if (empty($p->official_receipt_number)) {
                    $p->official_receipt_number = $this->mintOfficialReceiptNumber($p);
                }
                $p->confirmed_by = $request->user()->id;
                $p->confirmation_date = now();
            } else {
                $p->status = Payment::STATUS_PENDING;
                $p->amount_paid = 0;
                $p->paid_at = null;
                $p->confirmed_by = null;
                $p->confirmation_date = null;
                $p->invoice_pdf_path = null;
            }

            $p->save();
            $this->loanPaymentBalances->refreshLoanAfterPaymentChange($p->loan_id);
            $freshPayment = $p->fresh(['loan.borrower', 'confirmedByUser']);
            $becamePaid = $data['status'] === Payment::STATUS_PAID && $this->paymentJustBecamePaid($previousStatus, $p->status);
        });

        if ($freshPayment?->loan?->borrower) {
            $borrowerIdForScore = (int) $freshPayment->loan->borrower_id;
            dispatch(function () use ($borrowerIdForScore): void {
                try {
                    $b = User::query()->find($borrowerIdForScore);
                    if ($b) {
                        app(CreditScoreService::class)->recalculateForUser($b);
                    }
                } catch (\Throwable $e) {
                    report($e);
                }
            })->afterResponse();
        }

        $logger->log($request->user(), 'payments.status_update', $freshPayment ?? $payment, ['status' => ($freshPayment ?? $payment)->status]);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($becamePaid && $freshPayment) {
            $this->queuePaymentReceiptEmail($freshPayment, $request->user());
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            $this->deferPaymentPaidNotifications($freshPayment, $request->user());
        }

        $lastReceiptEmail = null;
        if ($freshPayment && trim((string) ($freshPayment->official_receipt_number ?? '')) !== '') {
            $lastReceiptEmail = EmailLog::query()
                ->where('dedupe_key', SendPaymentReceiptJob::dedupeKey($freshPayment->id, (string) $freshPayment->official_receipt_number))
                ->first();
        }

        $outPayment = $freshPayment ?? $payment;
        $outPayment->loadMissing(['loan.borrower', 'confirmedByUser']);

        return response()->json([
            'ok' => true,
            'payment' => $outPayment,
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
            'last_payment_receipt_email' => $this->formatPaymentReceiptEmailLog($lastReceiptEmail),
        ]);
    }

    /**
     * Adjust scheduled amount for the final installment only (penalties/discounts/settlement corrections).
     */
    public function adjustFinal(Request $request, Payment $payment, ActivityLogger $logger, CreditScoreService $creditScore): JsonResponse
    {
        $data = $request->validate([
            'amount_due' => 'required|numeric|min:0',
            'adjustment_reason' => 'required|string|min:8|max:2000',
        ]);

        $result = $this->finalPaymentAdjustments->adjustFinalInstallmentDue(
            $payment,
            $request->user(),
            (float) $data['amount_due'],
            (string) $data['adjustment_reason'],
        );

        $fresh = $result['payment'];
        $loan = $fresh->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditScore->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.adjust_final', $fresh, [
            'payment_id' => $fresh->id,
            'loan_id' => $fresh->loan_id,
            'audit_id' => $result['audit']->id,
        ]);

        if ($loan?->borrower) {
            app(NotificationCenter::class)->notifyBorrower(
                $loan->borrower,
                NotificationCenter::CATEGORY_LOAN_PAYMENT_ADJUSTED,
                'final_payment_adjusted',
                'Installment schedule updated',
                'Your final installment amount was updated by our team. Please review your borrower portal for the revised due amount.',
                [
                    'payment_id' => $fresh->id,
                    'loan_id' => $fresh->loan_id,
                    'new_amount_due' => (float) $fresh->amount_due,
                ],
                ['dedupe_key' => 'final_pay_adj:'.$result['audit']->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
            );
        }

        return response()->json([
            'ok' => true,
            'payment' => $fresh->fresh(['loan.borrower', 'adjustmentAudits.adminUser']),
        ]);
    }

    public function adjustmentAudits(Request $request, Payment $payment): JsonResponse
    {
        $rows = PaymentAdjustmentAudit::query()
            ->where('payment_id', $payment->id)
            ->with('adminUser:id,name,email')
            ->orderByDesc('id')
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    private function queuePaymentReceiptEmail(Payment $payment, User $admin): void
    {
        $payment->loadMissing(['loan.borrower:id,name,email']);
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        if ($or === '') {
            return;
        }

        $dedupeKey = SendPaymentReceiptJob::dedupeKey($payment->id, $or);
        $borrower = $payment->loan?->borrower;
        $email = trim((string) ($borrower?->email ?? ''));
        $validEmail = $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL);

        if (! $validEmail) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $payment->loan_id,
                    'payment_id' => $payment->id,
                    'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                    'mailable_class' => PaymentReceiptMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower?->name,
                    'subject' => null,
                    'status' => EmailLog::STATUS_FAILED,
                    'transport_detail' => 'invalid_recipient',
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['source' => 'PaymentController::queuePaymentReceiptEmail'],
                ]
            );

            return;
        }

        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $payment->loan_id,
                'payment_id' => $payment->id,
                'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                'mailable_class' => PaymentReceiptMail::class,
                'recipient_email' => $email,
                'recipient_name' => $borrower?->name,
                'subject' => null,
                'status' => EmailLog::STATUS_QUEUED,
                'transport_detail' => null,
                'error_message' => null,
                'meta' => ['source' => 'PaymentController::queuePaymentReceiptEmail'],
            ]
        );

        SendPaymentReceiptJob::dispatch($payment->id, $or, (int) $admin->id)->afterCommit()->afterResponse();
    }

    /**
     * In-app borrower + staff notifications after a payment is marked paid (not needed to block the HTTP response).
     */
    private function deferPaymentPaidNotifications(Payment $freshPayment, User $admin): void
    {
        $paymentId = (int) $freshPayment->id;
        $loanId = (int) $freshPayment->loan_id;
        $adminId = (int) $admin->id;
        $self = $this;

        dispatch(function () use ($self, $paymentId, $loanId, $adminId): void {
            try {
                $pay = Payment::query()->with(['loan.borrower'])->find($paymentId);
                if (! $pay || ! $pay->loan?->borrower) {
                    return;
                }

                $borrower = $pay->loan->borrower;
                $remaining = (float) (Payment::query()
                    ->where('loan_id', $loanId)
                    ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS r')
                    ->value('r') ?? 0);
                $remainingTxt = number_format($remaining, 2);

                app(NotificationCenter::class)->notifyBorrower(
                    $borrower,
                    NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
                    'payment_received',
                    'Payment recorded',
                    'Installment #'.($pay->installment_no ?? '—').' is marked paid. Remaining balance (scheduled): ₱'.$remainingTxt.'. Thank you.',
                    ['payment_id' => $pay->id, 'loan_id' => $pay->loan_id, 'remaining_balance' => $remaining],
                    ['dedupe_key' => 'payment_paid:'.$pay->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
                );

                $adminUser = User::query()->find($adminId);
                if ($adminUser) {
                    $self->notifyStaffPaymentConfirmed($pay, $adminUser);
                }
            } catch (\Throwable $e) {
                report($e);
            }
        })->afterResponse();
    }

    private function notifyStaffPaymentConfirmed(Payment $payment, User $admin): void
    {
        $payment->loadMissing('loan.borrower');
        $borrowerName = $payment->loan?->borrower?->name ?? 'Borrower';
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
            'payment_confirmed_staff',
            'Installment confirmed paid',
            'Loan #'.$payment->loan_id.' · '.$borrowerName.' · Inst #'.($payment->installment_no ?? '—').' · OR '.$or,
            [
                'payment_id' => $payment->id,
                'loan_id' => $payment->loan_id,
                'official_receipt_number' => $or,
            ],
            (int) $admin->id,
            [
                'module' => NotificationCenter::MODULE_PAYMENTS,
                'throttle_key' => 'payment_confirmed_staff:'.$payment->id,
                'throttle_max' => 1,
                'throttle_decay_seconds' => 3600,
            ],
        );
    }

    /**
     * @param  Collection<int, mixed>  $paymentIds
     * @return array<int, string>
     */
    private function receiptEmailStatusMapForPaymentIds(Collection $paymentIds): array
    {
        $ids = $paymentIds->filter(fn ($id) => (int) $id > 0)->map(fn ($id) => (int) $id)->unique()->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $latestIds = EmailLog::query()
            ->selectRaw('max(id) as agg_id')
            ->whereIn('payment_id', $ids)
            ->where('notification_type', EmailLog::NOTIFICATION_PAYMENT_RECEIPT)
            ->groupBy('payment_id')
            ->pluck('agg_id');
        if ($latestIds->isEmpty()) {
            return [];
        }

        return EmailLog::query()
            ->whereIn('id', $latestIds)
            ->get()
            ->mapWithKeys(fn (EmailLog $e) => [(int) $e->payment_id => (string) $e->status])
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function formatPaymentReceiptEmailLog(?EmailLog $row): ?array
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

    private function paymentJustBecamePaid(string $previousStatus, string $currentStatus): bool
    {
        $prev = strtolower(trim($previousStatus));
        $cur = strtolower(trim($currentStatus));

        return $cur === Payment::STATUS_PAID && $prev !== Payment::STATUS_PAID;
    }

    private function mintOfficialReceiptNumber(Payment $payment): string
    {
        $seq = sprintf('%06d', (int) $payment->id);
        $loan = sprintf('%04d', (int) $payment->loan_id);
        $base = 'OR'.now()->format('Ymd').'-L'.$loan.'-'.$seq;
        $out = $base;
        $n = 0;
        while (Payment::query()->where('official_receipt_number', $out)->exists()) {
            $n++;
            $out = $base.'-'.$n;
        }

        return $out;
    }

    /**
     * Resolve admin “loan number” filter: numeric id, #id, or LN-000123.
     */
    private function parseLoanSearchToId(string $raw): ?int
    {
        $t = strtolower(trim($raw));
        if ($t === '') {
            return null;
        }
        if (preg_match('/^ln-0*(\d+)$/', $t, $m)) {
            return (int) $m[1];
        }
        if (preg_match('/^#?(\d+)$/', $t, $m)) {
            return (int) $m[1];
        }

        return null;
    }
}
