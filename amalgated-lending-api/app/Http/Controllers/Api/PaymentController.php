<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentListResource;
use App\Jobs\SendPaymentReceiptJob;
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

class PaymentController extends Controller
{
    public function __construct(
        private LoanPaymentBalanceService $loanPaymentBalances,
        private FinalPaymentAdjustmentService $finalPaymentAdjustments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = Payment::query()->with('loan.borrower');

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

        $rows->setCollection(PaymentListResource::collection($rows->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function forUser(Request $request, User $user): JsonResponse
    {
        $loanIds = Loan::where('borrower_id', $user->id)->pluck('id');
        $payments = Payment::whereIn('loan_id', $loanIds)
            ->with('loan')
            ->orderByDesc('due_date')
            ->paginate((int) $request->query('per_page', 15));

        return response()->json(['ok' => true, 'data' => $payments]);
    }

    public function record(Request $request, Payment $payment, ActivityLogger $logger, CreditScoreService $creditScore): JsonResponse
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

        $previousStatus = $payment->status;

        $payment->amount_paid = $data['amount_paid'];
        $payment->paid_at = isset($data['paid_at']) ? Carbon::parse($data['paid_at']) : now();
        $payment->source = $data['source'] ?? 'manual';
        if (isset($data['external_ref'])) {
            $payment->external_ref = $data['external_ref'];
        }
        if (isset($data['notes'])) {
            $payment->notes = $data['notes'];
        }

        if ($payment->amount_paid >= $payment->amount_due - 0.01) {
            $payment->status = Payment::STATUS_PAID;
        } elseif ($payment->amount_paid > 0) {
            $payment->status = Payment::STATUS_PARTIAL;
        }

        if ($payment->status !== Payment::STATUS_PAID && $payment->due_date->isPast()) {
            $payment->status = Payment::STATUS_OVERDUE;
        }

        if ($this->paymentJustBecamePaid($previousStatus, $payment->status) && empty($payment->official_receipt_number)) {
            $payment->official_receipt_number = $this->mintOfficialReceiptNumber($payment);
        }

        $payment->save();

        $this->loanPaymentBalances->refreshLoanAfterPaymentChange($payment->loan_id);

        $loan = $payment->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditScore->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.record', $payment);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($this->paymentJustBecamePaid($previousStatus, $payment->status)) {
            SendPaymentReceiptJob::dispatch($payment->id);
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            if ($loan?->borrower) {
                $remaining = (float) (Payment::query()
                    ->where('loan_id', $payment->loan_id)
                    ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS r')
                    ->value('r') ?? 0);
                $remainingTxt = number_format($remaining, 2);
                app(NotificationCenter::class)->notifyBorrower(
                    $loan->borrower,
                    NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
                    'payment_received',
                    'Payment recorded',
                    'Installment #'.($payment->installment_no ?? '—').' is marked paid. Remaining balance (scheduled): ₱'.$remainingTxt.'. Thank you.',
                    ['payment_id' => $payment->id, 'loan_id' => $payment->loan_id, 'remaining_balance' => $remaining],
                    ['dedupe_key' => 'payment_paid:'.$payment->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
                );
            }
        }

        return response()->json([
            'ok' => true,
            'payment' => $payment->fresh(['loan']),
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
        ]);
    }

    public function updateStatus(Request $request, Payment $payment, ActivityLogger $logger, CreditScoreService $creditScore): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|string|in:pending,paid',
        ]);

        $previousStatus = $payment->status;

        if ($data['status'] === Payment::STATUS_PAID) {
            $payment->status = Payment::STATUS_PAID;
            $payment->amount_paid = $payment->amount_due;
            $payment->paid_at = now();
            $payment->source = $payment->source ?: 'manual';
        } else {
            $payment->status = Payment::STATUS_PENDING;
            $payment->amount_paid = 0;
            $payment->paid_at = null;
        }

        if ($this->paymentJustBecamePaid($previousStatus, $payment->status) && empty($payment->official_receipt_number)) {
            $payment->official_receipt_number = $this->mintOfficialReceiptNumber($payment);
        }

        $payment->save();
        $this->loanPaymentBalances->refreshLoanAfterPaymentChange($payment->loan_id);

        $loan = $payment->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditScore->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.status_update', $payment, ['status' => $payment->status]);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($data['status'] === Payment::STATUS_PAID && $this->paymentJustBecamePaid($previousStatus, $payment->status)) {
            SendPaymentReceiptJob::dispatch($payment->id);
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
            if ($loan?->borrower) {
                $remaining = (float) (Payment::query()
                    ->where('loan_id', $payment->loan_id)
                    ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS r')
                    ->value('r') ?? 0);
                $remainingTxt = number_format($remaining, 2);
                app(NotificationCenter::class)->notifyBorrower(
                    $loan->borrower,
                    NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
                    'payment_received',
                    'Payment recorded',
                    'Installment #'.($payment->installment_no ?? '—').' is marked paid. Remaining balance (scheduled): ₱'.$remainingTxt.'. Thank you.',
                    ['payment_id' => $payment->id, 'loan_id' => $payment->loan_id, 'remaining_balance' => $remaining],
                    ['dedupe_key' => 'payment_paid:'.$payment->id, 'module' => NotificationCenter::MODULE_PAYMENTS],
                );
            }
        }

        return response()->json([
            'ok' => true,
            'payment' => $payment->fresh(['loan']),
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
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
