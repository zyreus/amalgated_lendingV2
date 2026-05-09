<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;

/**
 * Recomputes loan outstanding balance and completion state from the payment ledger.
 */
class LoanPaymentBalanceService
{
    public function refreshLoanAfterPaymentChange(int $loanId): void
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
