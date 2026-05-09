<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Payment;
use App\Models\PaymentAdjustmentAudit;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FinalPaymentAdjustmentService
{
    public function __construct(
        private LoanPaymentBalanceService $balances,
    ) {}

    /**
     * @return array{payment: Payment, audit: PaymentAdjustmentAudit}
     */
    public function adjustFinalInstallmentDue(
        Payment $payment,
        User $admin,
        float $newAmountDue,
        string $reason,
    ): array {
        $reason = trim($reason);
        if ($reason === '' || mb_strlen($reason) < 8) {
            throw ValidationException::withMessages([
                'adjustment_reason' => ['Please enter a clear reason (at least 8 characters).'],
            ]);
        }

        if ($newAmountDue < 0) {
            throw ValidationException::withMessages([
                'amount_due' => ['Adjusted amount cannot be negative.'],
            ]);
        }

        return DB::transaction(function () use ($payment, $admin, $newAmountDue, $reason) {
            $payment = Payment::query()->whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $loan = Loan::query()->whereKey($payment->loan_id)->lockForUpdate()->firstOrFail();

            if ($loan->status !== Loan::STATUS_ONGOING) {
                throw ValidationException::withMessages([
                    'loan' => ['Final payment can only be adjusted for active (ongoing) loans.'],
                ]);
            }

            $term = max(1, (int) $loan->term_months);
            if ((int) $payment->installment_no !== $term) {
                throw ValidationException::withMessages([
                    'payment' => ['Only the last installment (#'.$term.') can be adjusted.'],
                ]);
            }

            $previous = round((float) $payment->amount_due, 2);
            $newRounded = round($newAmountDue, 2);

            if ($payment->original_amount_due === null) {
                $payment->original_amount_due = $previous;
            }

            $payment->amount_due = $newRounded;
            $payment->is_final_payment = true;
            $payment->adjusted_by = $admin->id;
            $payment->adjustment_reason = $reason;
            $payment->adjusted_at = now();

            $due = $newRounded;
            $paid = (float) ($payment->amount_paid ?? 0);
            if ($due <= 0.009) {
                $payment->status = $paid > 0 ? Payment::STATUS_PAID : Payment::STATUS_PENDING;
            } elseif ($paid >= $due - 0.01) {
                $payment->status = Payment::STATUS_PAID;
                $payment->paid_at = $payment->paid_at ?? now();
            } elseif ($paid > 0) {
                $payment->status = Payment::STATUS_PARTIAL;
            } else {
                $payment->status = Payment::STATUS_PENDING;
            }

            if ($payment->status !== Payment::STATUS_PAID && $payment->due_date && $payment->due_date->isPast()) {
                $payment->status = Payment::STATUS_OVERDUE;
            }

            $payment->save();

            $this->syncLastScheduleRow($loan, $term, $newRounded);

            $audit = PaymentAdjustmentAudit::query()->create([
                'payment_id' => $payment->id,
                'loan_id' => $loan->id,
                'previous_amount_due' => $previous,
                'new_amount_due' => $newRounded,
                'admin_user_id' => $admin->id,
                'reason' => $reason,
                'created_at' => now(),
            ]);

            $this->balances->refreshLoanAfterPaymentChange($loan->id);

            return [
                'payment' => $payment->fresh(['loan.borrower']),
                'audit' => $audit,
            ];
        });
    }

    private function syncLastScheduleRow(Loan $loan, int $term, float $newPayment): void
    {
        $schedule = is_array($loan->schedule_json) ? $loan->schedule_json : [];
        if ($schedule === []) {
            return;
        }

        $updated = false;
        foreach ($schedule as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            if ((int) ($row['installment_no'] ?? 0) !== $term) {
                continue;
            }
            $row['payment'] = $newPayment;
            $row['amortization'] = $newPayment;
            $schedule[$i] = $row;
            $updated = true;
            break;
        }

        if ($updated) {
            $loan->schedule_json = $schedule;
            $loan->save();
        }
    }
}
