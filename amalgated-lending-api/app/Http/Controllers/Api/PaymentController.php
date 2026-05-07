<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PaymentListResource;
use App\Jobs\SendPaymentReceiptJob;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\CreditScoreService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
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

        $payment->save();

        $this->refreshLoanBalance($payment->loan_id);

        $loan = $payment->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditScore->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.record', $payment);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($this->paymentJustBecamePaid($previousStatus, $payment->status)) {
            SendPaymentReceiptJob::dispatch($payment->id);
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
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

        $payment->save();
        $this->refreshLoanBalance($payment->loan_id);

        $loan = $payment->loan()->with('borrower')->first();
        if ($loan?->borrower) {
            $creditScore->recalculateForUser($loan->borrower);
        }

        $logger->log($request->user(), 'payments.status_update', $payment, ['status' => $payment->status]);

        $receiptEmail = ['sent' => false, 'note' => null];
        if ($data['status'] === Payment::STATUS_PAID && $this->paymentJustBecamePaid($previousStatus, $payment->status)) {
            SendPaymentReceiptJob::dispatch($payment->id);
            $receiptEmail = ['sent' => true, 'note' => 'queued'];
        }

        return response()->json([
            'ok' => true,
            'payment' => $payment->fresh(['loan']),
            'receipt_email_sent' => $receiptEmail['sent'],
            'receipt_email_note' => $receiptEmail['note'],
        ]);
    }

    private function paymentJustBecamePaid(string $previousStatus, string $currentStatus): bool
    {
        $prev = strtolower(trim($previousStatus));
        $cur = strtolower(trim($currentStatus));

        return $cur === Payment::STATUS_PAID && $prev !== Payment::STATUS_PAID;
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

    private function refreshLoanBalance(int $loanId): void
    {
        $loan = Loan::find($loanId);
        if (! $loan) {
            return;
        }

        $summary = Payment::query()
            ->where('loan_id', $loanId)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS remaining_balance')
            ->selectRaw('SUM(CASE WHEN status != ? THEN 1 ELSE 0 END) AS unpaid_count', [Payment::STATUS_PAID])
            ->first();

        $loan->outstanding_balance = round((float) ($summary?->remaining_balance ?? 0), 2);
        $unpaid = (int) ($summary?->unpaid_count ?? 0);
        if ($unpaid === 0 && $loan->status === Loan::STATUS_ONGOING) {
            $loan->status = Loan::STATUS_COMPLETED;
            $loan->completed_at = now();
        }
        $loan->save();

        if ($loan->status === Loan::STATUS_COMPLETED && $loan->borrower_id) {
            $this->archiveBorrowerWhenNoActiveLoans((int) $loan->borrower_id);
        }
    }

    private function archiveBorrowerWhenNoActiveLoans(int $borrowerId): void
    {
        $borrower = User::find($borrowerId);
        if (! $borrower || ! $borrower->is_active) {
            return;
        }

        $hasActiveLoans = Loan::where('borrower_id', $borrowerId)
            ->whereIn('status', [Loan::STATUS_PENDING, Loan::STATUS_APPROVED, Loan::STATUS_ONGOING])
            ->exists();

        if ($hasActiveLoans) {
            return;
        }

        $borrower->is_active = false;
        $borrower->save();
    }
}
