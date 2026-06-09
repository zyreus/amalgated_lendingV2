<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Payment;
use Carbon\CarbonInterface;

class LoanComputationService
{
    /**
     * @return array<string, mixed>
     */
    public function monthlyStatementAmounts(Loan $loan, CarbonInterface $statementMonth): array
    {
        $loan->loadMissing('payments');
        $monthStart = $statementMonth->copy()->startOfMonth();
        $monthEnd = $statementMonth->copy()->endOfMonth();

        $payments = $loan->payments;
        $installmentsForMonth = $payments->filter(fn (Payment $payment) => $payment->due_date?->betweenIncluded($monthStart, $monthEnd));
        $openInstallments = $payments->filter(fn (Payment $payment) => ! in_array($payment->status, [Payment::STATUS_PAID, Payment::STATUS_WAIVED], true));
        $overdueInstallments = $openInstallments->filter(fn (Payment $payment) => $payment->due_date && $payment->due_date->isPast());

        $monthlyDue = (float) ($installmentsForMonth->sum(fn (Payment $payment) => max(0, (float) $payment->amount_due - (float) $payment->amount_paid))
            ?: ($loan->monthly_payment ?? $loan->monthly_principal ?? 0));
        $penalties = (float) $overdueInstallments->sum('penalty_amount');
        $remainingBalance = (float) ($openInstallments->sum(fn (Payment $payment) => max(0, (float) $payment->amount_due - (float) $payment->amount_paid))
            ?: ($loan->outstanding_balance ?? 0));

        $nextPayment = $openInstallments->sortBy('due_date')->first();

        return [
            'monthly_due' => round($monthlyDue, 2),
            'penalties' => round($penalties, 2),
            'remaining_balance' => round($remainingBalance, 2),
            'total_due' => round($monthlyDue + $penalties, 2),
            'due_date' => $nextPayment?->due_date?->toDateString() ?? $monthEnd->toDateString(),
            'payment_history' => $payments
                ->sortByDesc('due_date')
                ->take(12)
                ->values()
                ->map(fn (Payment $payment) => [
                    'id' => $payment->id,
                    'installment_no' => $payment->installment_no,
                    'due_date' => $payment->due_date?->toDateString(),
                    'amount_due' => (float) $payment->amount_due,
                    'amount_paid' => (float) $payment->amount_paid,
                    'penalty_amount' => (float) $payment->penalty_amount,
                    'official_receipt_number' => $payment->official_receipt_number,
                    'acknowledgement_receipt_number' => $payment->acknowledgement_receipt_number,
                    'or_number' => $payment->official_receipt_number,
                    'ar_number' => $payment->acknowledgement_receipt_number,
                    'status' => $payment->status,
                    'paid_at' => $payment->paid_at?->toIso8601String(),
                ])
                ->all(),
            'performance' => [
                'paid_count' => $payments->where('status', Payment::STATUS_PAID)->count(),
                'overdue_count' => $overdueInstallments->count(),
                'partial_count' => $payments->where('status', Payment::STATUS_PARTIAL)->count(),
                'total_installments' => $payments->count(),
            ],
        ];
    }
}
