<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Central service for staff adjustments to approved/working loan amounts.
 * Recomputes calculator output and rebuilds the payment ledger when safe.
 */
class LoanAmountAdjustmentService
{
    public function __construct(
        private LoanCalculator $calculator,
        private LoanPaymentBalanceService $balanceService,
        private LoanProductRateResolver $loanProductRates,
        private BorrowerLoanApplicationNotifier $borrowerNotifier,
    ) {}

    /**
     * @return array{loan: Loan, ledger_rebuilt: bool, previous_amount: float, new_amount: float}
     */
    public function adjustApprovedAmount(Loan $loan, User $actor, float $newAmount, ?string $notes = null): array
    {
        return DB::transaction(function () use ($loan, $actor, $newAmount, $notes) {
            $loan = Loan::query()
                ->whereKey($loan->getKey())
                ->lockForUpdate()
                ->with('loanApplication')
                ->firstOrFail();

            $previous = round((float) ($loan->approved_principal ?? $loan->principal), 2);
            $newAmount = round($newAmount, 2);

            $this->ensureRequestedPrincipalFrozen($loan);

            $loan->approved_principal = $newAmount;
            $loan->principal = $newAmount;
            $loan->amount_modified_by = $actor->id;
            $loan->amount_modified_at = now();

            if ($notes !== null && trim($notes) !== '') {
                $loan->approval_notes = trim($notes);
            }

            $compute = $this->recomputeLoan($loan, $newAmount);
            $this->applyComputationToLoan($loan, $compute);
            $this->appendAmountHistory($loan, $actor, $previous, $newAmount, $notes);

            $loan->save();

            if ($loan->loanApplication) {
                $loan->loanApplication->approved_amount = $newAmount;
                if ($loan->loanApplication->computation_breakdown !== null || $loan->loanApplication->computed_values !== null) {
                    $loan->loanApplication->computation_breakdown = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : $loan->loanApplication->computation_breakdown;
                    $loan->loanApplication->computed_values = is_array($compute['summary'] ?? null) ? $compute['summary'] : $loan->loanApplication->computed_values;
                }
                $loan->loanApplication->save();
            }

            $ledgerRebuilt = false;
            if ($this->isServicingLoan($loan)) {
                $schedule = is_array($compute['schedule'] ?? null) ? $compute['schedule'] : [];
                $ledgerRebuilt = $this->rebuildLedgerIfAllowed($loan, $schedule);
                if ($ledgerRebuilt) {
                    $this->balanceService->refreshLoanAfterPaymentChange((int) $loan->id);
                }
            }

            $fresh = $loan->fresh(['loanApplication', 'amountModifier', 'approver', 'borrower']);
            $notification = $this->borrowerNotifier->notifyApprovedAmountChanged(
                $fresh,
                $actor,
                $previous,
                $newAmount,
                $notes,
            );

            return [
                'loan' => $fresh,
                'ledger_rebuilt' => $ledgerRebuilt,
                'previous_amount' => $previous,
                'new_amount' => $newAmount,
                'borrower_notification' => $notification,
            ];
        });
    }

    private function ensureRequestedPrincipalFrozen(Loan $loan): void
    {
        if ($loan->requested_principal !== null) {
            return;
        }

        if ($loan->loanApplication?->loan_amount !== null && (float) $loan->loanApplication->loan_amount > 0) {
            $loan->requested_principal = round((float) $loan->loanApplication->loan_amount, 2);

            return;
        }

        if ((float) $loan->principal > 0) {
            $loan->requested_principal = round((float) $loan->principal, 2);
        }
    }

    /** @return array<string, mixed> */
    private function recomputeLoan(Loan $loan, float $principal): array
    {
        $payload = is_array($loan->application_payload) ? $loan->application_payload : [];
        $productSlug = $this->resolveProductSlug($loan, $payload);
        $applicationNature = (string) ($payload['application_nature'] ?? 'new');
        $age = $payload['age'] ?? null;
        $monthlyPension = $payload['monthly_pension'] ?? null;
        $pensionType = $payload['pension_type'] ?? null;
        $rateOverride = isset($loan->adjusted_monthly_rate_percent) ? (float) $loan->adjusted_monthly_rate_percent : null;

        return $this->calculator->compute([
            'product_slug' => $productSlug,
            'loan_amount' => $principal,
            'term_months' => max(1, (int) $loan->term_months),
            'application_nature' => $applicationNature,
            'age' => $age !== null && $age !== '' ? (int) $age : null,
            'monthly_pension' => $monthlyPension !== null && $monthlyPension !== '' ? (float) $monthlyPension : null,
            'pension_type' => $pensionType !== null && $pensionType !== '' ? (string) $pensionType : null,
            'monthly_rate_percent_override' => $rateOverride,
        ]);
    }

    /** @param array<string, mixed> $compute */
    private function applyComputationToLoan(Loan $loan, array $compute): void
    {
        $product = is_array($compute['product'] ?? null) ? $compute['product'] : [];
        $breakdown = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [];
        $schedule = is_array($compute['schedule'] ?? null) ? $compute['schedule'] : [];

        $monthlyRate = isset($product['monthly_rate_percent_effective']) ? (float) $product['monthly_rate_percent_effective'] : null;
        if ($monthlyRate !== null) {
            $loan->annual_interest_rate = round($monthlyRate * 12.0, 4);
        }

        $loan->whole_term_interest_percent = isset($breakdown['whole_term_interest_percent']) ? (float) $breakdown['whole_term_interest_percent'] : $loan->whole_term_interest_percent;
        $loan->monthly_principal = isset($breakdown['monthly_principal']) ? round((float) $breakdown['monthly_principal'], 2) : $loan->monthly_principal;
        $loan->monthly_interest = isset($breakdown['monthly_interest']) ? round((float) $breakdown['monthly_interest'], 2) : $loan->monthly_interest;
        $loan->service_charge = isset($breakdown['service_charge']) ? round((float) $breakdown['service_charge'], 2) : $loan->service_charge;
        $loan->mri_fee = isset($breakdown['mri_fee']) ? round((float) $breakdown['mri_fee'], 2) : (isset($breakdown['insurance']) ? round((float) $breakdown['insurance'], 2) : $loan->mri_fee);
        $loan->doc_stamp = isset($breakdown['doc_stamp']) ? round((float) $breakdown['doc_stamp'], 2) : $loan->doc_stamp;
        $loan->notarial_fee = isset($breakdown['notarial_fee']) ? round((float) $breakdown['notarial_fee'], 2) : $loan->notarial_fee;
        $loan->mortgage_fee = isset($breakdown['mortgage_fee']) ? round((float) $breakdown['mortgage_fee'], 2) : $loan->mortgage_fee;
        $loan->total_deductions = isset($breakdown['total_deductions']) ? round((float) $breakdown['total_deductions'], 2) : $loan->total_deductions;
        $loan->net_proceeds = isset($breakdown['net_proceeds']) ? round((float) $breakdown['net_proceeds'], 2) : $loan->net_proceeds;
        $loan->total_payment = isset($breakdown['total_payment']) ? round((float) $breakdown['total_payment'], 2) : $loan->total_payment;
        $loan->monthly_payment = isset($breakdown['monthly_amortization']) ? (float) $breakdown['monthly_amortization'] : $loan->monthly_payment;
        $loan->total_interest = isset($breakdown['total_add_on_interest']) ? (float) $breakdown['total_add_on_interest'] : $loan->total_interest;
        $loan->schedule_json = $schedule;

        if (! $this->isServicingLoan($loan)) {
            $loan->outstanding_balance = round((float) array_sum(array_map(fn ($r) => (float) ($r['payment'] ?? 0), $schedule)), 2);
        }

        $productSlug = $this->resolveProductSlug($loan, is_array($loan->application_payload) ? $loan->application_payload : []);
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

        $loan->loan_computation_snapshot = [
            'engine' => 'LoanCalculator/v2',
            'product' => $product,
            'inputs' => is_array($compute['inputs'] ?? null) ? $compute['inputs'] : [],
            'breakdown' => $breakdown,
            'summary' => is_array($compute['summary'] ?? null) ? $compute['summary'] : [],
            'schedule' => $schedule,
            'generated_at' => now()->toIso8601String(),
        ];

        $overrideLogs = is_array($loan->admin_override_logs) ? $loan->admin_override_logs : [];
        $overrideLogs[] = [
            'event' => 'amount_adjustment_recompute',
            'at' => now()->toIso8601String(),
            'principal' => (float) $loan->approved_principal,
            'term_months' => (int) $loan->term_months,
        ];
        $loan->admin_override_logs = $overrideLogs;
    }

    private function appendAmountHistory(Loan $loan, User $actor, float $previous, float $newAmount, ?string $notes): void
    {
        $history = is_array($loan->approval_history) ? $loan->approval_history : [];
        $history[] = [
            'event' => 'approved_amount_changed',
            'at' => now()->toIso8601String(),
            'user_id' => $actor->id,
            'user_name' => $actor->name,
            'previous_approved_principal' => $previous,
            'approved_principal' => $newAmount,
            'notes' => $notes,
        ];
        $loan->approval_history = $history;
    }

    /** @param list<array<string, mixed>> $schedule */
    private function rebuildLedgerIfAllowed(Loan $loan, array $schedule): bool
    {
        $hasCollections = Payment::query()
            ->where('loan_id', $loan->id)
            ->where('amount_paid', '>', 0)
            ->exists();

        if ($hasCollections || $schedule === []) {
            return false;
        }

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

        $loan->outstanding_balance = round((float) array_sum(array_map(fn ($r) => (float) ($r['payment'] ?? 0), $schedule)), 2);
        $loan->save();

        return true;
    }

    private function isServicingLoan(Loan $loan): bool
    {
        return in_array($loan->status, array_merge(Loan::activeServicingStatuses(), [
            Loan::STATUS_APPROVED,
            'ongoing',
        ]), true);
    }

    /** @param array<string, mixed> $payload */
    private function resolveProductSlug(Loan $loan, array $payload): string
    {
        $productSlug = isset($payload['loan_product_slug']) && is_string($payload['loan_product_slug'])
            ? trim($payload['loan_product_slug'])
            : '';

        if ($productSlug !== '') {
            return $productSlug;
        }

        $la = $loan->loanApplication;
        if ($la) {
            $mapped = match ($la->loan_type) {
                LoanApplication::TYPE_REAL_ESTATE => 'real-estate-mortgage',
                LoanApplication::TYPE_CHATTEL => 'chattel-mortgage',
                LoanApplication::TYPE_SALARY => 'salary-loan',
                LoanApplication::TYPE_TRAVEL_ASSISTANCE => 'travel-assistance-loan',
                LoanApplication::TYPE_SSS_PENSION => 'sss-pension-loan',
                default => null,
            };
            if (is_string($mapped)) {
                return $mapped;
            }
        }

        $monthlyRateGuess = null;
        if (isset($payload['selected_interest_rate']) && is_numeric($payload['selected_interest_rate'])) {
            $monthlyRateGuess = (float) $payload['selected_interest_rate'];
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

        return $candidate?->slug ?? 'real-estate-mortgage';
    }
}
