<?php

namespace App\Services;

use App\Models\LoanProduct;
use Illuminate\Validation\ValidationException;

class LoanCalculator
{
    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function compute(array $input): array
    {
        $amount = (float) ($input['loan_amount'] ?? 0);
        $term = max(1, (int) ($input['term_months'] ?? 0));
        $applicationNature = (string) ($input['application_nature'] ?? 'new');

        $product = $this->resolveProduct($input);
        if (! $product) {
            throw ValidationException::withMessages([
                'product' => ['Loan product was not found.'],
            ]);
        }

        if ($amount <= 0) {
            throw ValidationException::withMessages([
                'loan_amount' => ['Loan amount must be greater than zero.'],
            ]);
        }

        if ($product->max_amount !== null && (float) $product->max_amount > 0 && $amount > (float) $product->max_amount) {
            throw ValidationException::withMessages([
                'loan_amount' => ['Loan amount exceeds product maximum of ₱'.number_format((float) $product->max_amount, 2).'.'],
            ]);
        }

        if ($product->max_term !== null && $term > (int) $product->max_term) {
            throw ValidationException::withMessages([
                'term_months' => ['Term exceeds product maximum of '.$product->max_term.' months.'],
            ]);
        }

        $cfg = is_array($product->calculator_config) ? $product->calculator_config : [];
        $rules = is_array($product->rules) ? $product->rules : [];

        $term = $this->resolveEffectiveTermMonths($product, $cfg, $term);

        $monthlyRatePercent = $this->resolveMonthlyRatePercent($product, $term);

        $age = isset($input['age']) ? (int) $input['age'] : null;
        if ($age !== null && $product->age_limit !== null && $age > (int) $product->age_limit) {
            throw ValidationException::withMessages([
                'age' => ['Borrower age exceeds the allowed product age limit.'],
            ]);
        }

        if ($product->slug === 'sss-pension-loan') {
            // SOA computation depends on loan amount + term.
            // "Pension verification required" is a qualification gate; do not hard-require monthly_pension here.
            // If monthly_pension is provided, optionally apply configured cap logic.
            if (array_key_exists('monthly_pension', $input)) {
                $monthlyPension = (float) ($input['monthly_pension'] ?? 0);
                if ($monthlyPension > 0) {
                    $multiplier = (float) ($cfg['pension_multiplier'] ?? 18.75);
                    $pensionMax = $this->money($monthlyPension * $multiplier);
                    if ($amount > $pensionMax && $pensionMax > 0) {
                        throw ValidationException::withMessages([
                            'loan_amount' => ['Loan amount exceeds pension-based limit of ₱'.number_format($pensionMax, 2).'.'],
                        ]);
                    }
                }
            }
        }

        $feeProfile = (string) ($cfg['fee_profile'] ?? '');
        $miscDeductedFromProceeds = $this->miscellaneousAreDeductedFromProceeds($product, $feeProfile, $rules);

        $serviceChargeRate = (float) ($rules['service_charge_rate'] ?? 0.035);
        $svcMode = (string) ($rules['service_charge_mode'] ?? 'percent');
        $insurancePerThousand = (float) ($rules['insurance_per_1000'] ?? $cfg['insurance_per_1000'] ?? 35.0);
        $insuranceFixed = (float) ($rules['insurance_fixed'] ?? 2000.0);
        $mortgageRate = (float) ($rules['mortgage_fee_rate'] ?? 0.025);
        $mortgageThreshold = (float) ($rules['mortgage_fee_threshold'] ?? 0);
        $notarialNew = (float) ($rules['notarial_fee_new'] ?? $cfg['notarial_new_loan'] ?? 1500.0);
        $notarialReloan = (float) ($rules['notarial_fee_reloan'] ?? $cfg['notarial_reloan'] ?? $notarialNew);

        $serviceCharge = $this->computeServiceCharge($amount, $applicationNature, $serviceChargeRate, $svcMode, $rules, $cfg);
        $insurance = $feeProfile === 'travel'
            ? 0.0
            : $this->money(($amount / 1000.0) * $insurancePerThousand + $insuranceFixed);
        $docStamp = $this->computeDocStamp($amount, $rules);
        $notarialFee = $this->money($applicationNature === 'reloan' ? $notarialReloan : $notarialNew);

        $isMortgageProduct = in_array($product->slug, ['real-estate-mortgage', 'chattel-mortgage'], true);
        $mortgageFee = $this->money(
            $isMortgageProduct && $amount >= $mortgageThreshold ? $amount * $mortgageRate : 0.0
        );

        $monthlyPrincipal = $this->money($amount / max(1, $term));
        $monthlyInterest = $this->money($amount * ($monthlyRatePercent / 100.0));
        $monthlyAmortization = $this->money($monthlyPrincipal + $monthlyInterest);
        $totalMiscFees = $this->money($serviceCharge + $insurance + $docStamp + $notarialFee + $mortgageFee);
        $netProceeds = $miscDeductedFromProceeds ? $this->money($amount - $totalMiscFees) : $this->money($amount);
        $totalAddOnInterest = $this->money($monthlyInterest * $term);
        $totalPayable = $this->money($monthlyAmortization * $term);

        $schedule = $this->buildStraightLineSchedule($amount, $term, $monthlyPrincipal, $monthlyInterest, $monthlyAmortization);

        $openingAccountFee = ($product->slug === 'travel-assistance-loan')
            ? (float) ($rules['opening_account_fee'] ?? $cfg['opening_account_fee'] ?? 10000)
            : 0.0;

        return [
            'product' => [
                'id' => $product->id,
                'slug' => $product->slug,
                'code' => $product->code,
                'name' => $product->name,
                'rate_type' => $product->rate_type,
                'interest_rate' => (float) $product->interest_rate,
                'monthly_rate_percent_effective' => $this->money($monthlyRatePercent, 4),
            ],
            'inputs' => [
                'loan_amount' => $this->money($amount),
                'term_months' => $term,
                'application_nature' => $applicationNature,
                'age' => $age,
                'monthly_pension' => isset($input['monthly_pension']) ? $this->money((float) $input['monthly_pension']) : null,
            ],
            'breakdown' => [
                'service_charge' => $serviceCharge,
                'insurance' => $insurance,
                'documentary_stamp' => $docStamp,
                'notarial_fee' => $notarialFee,
                'mortgage_fee' => $mortgageFee,
                'opening_account_fee' => $openingAccountFee > 0 ? $this->money($openingAccountFee) : 0.0,
                'miscellaneous_deducted_from_proceeds' => $miscDeductedFromProceeds,
                'monthly_principal' => $monthlyPrincipal,
                'monthly_interest' => $monthlyInterest,
                'monthly_amortization' => $monthlyAmortization,
                'total_add_on_interest' => $totalAddOnInterest,
                'total_payable' => $totalPayable,
                'total_miscellaneous_fees' => $totalMiscFees,
                'net_proceeds' => $netProceeds,
            ],
            'summary' => [
                'loan_amount' => $this->money($amount),
                'term_months' => $term,
                'monthly_rate_percent_effective' => $this->money($monthlyRatePercent, 4),
                'total_add_on_interest' => $totalAddOnInterest,
                'total_payable' => $totalPayable,
                'total_miscellaneous_fees' => $totalMiscFees,
                'net_proceeds' => $netProceeds,
            ],
            'schedule' => $schedule,
            'notes' => array_values(array_filter([
                $product->slug === 'travel-assistance-loan' ? 'Travel assistance: monthly renewal (default one-month billing cycle); miscellaneous fees shown for quotation reference and are not deducted from disbursement; Landbank opening account fee is billed separately.' : null,
                $product->slug === 'salary-loan' ? 'Salary loans are commonly settled through salary deduction arrangements.' : null,
                $product->slug === 'sss-pension-loan' ? 'Pensioner loan uses pension multiplier and age policy checks.' : null,
                $age !== null && $product->safe_age !== null && $age > (int) $product->safe_age && $product->slug === 'sss-pension-loan'
                    ? 'Borrower exceeds the conservative safe age threshold ('.$product->safe_age.'). Obtain compliance / branch approval.'
                    : null,
            ])),
            'raw_rules' => [
                'fee_profile' => $feeProfile,
                'service_charge_mode' => $svcMode,
                'service_charge_rate' => $serviceChargeRate,
                'insurance_per_1000' => $insurancePerThousand,
                'insurance_fixed' => $insuranceFixed,
                'mortgage_fee_rate' => $mortgageRate,
                'mortgage_fee_threshold' => $mortgageThreshold,
            ],
        ];
    }

    /**
     * REM/CHM, pension, salary: withhold misc from disbursement unless rules override.
     * Travel assistance: disburse full principal — fees are billed separately per policy.
     *
     * @param  array<string, mixed>  $rules
     */
    private function miscellaneousAreDeductedFromProceeds(LoanProduct $product, string $feeProfile, array $rules): bool
    {
        if (($rules['miscellaneous_deducted_from_proceeds'] ?? null) !== null) {
            return (bool) $rules['miscellaneous_deducted_from_proceeds'];
        }

        if ($feeProfile === 'travel' || $product->slug === 'travel-assistance-loan') {
            return false;
        }

        return true;
    }

    /**
     * @param  array<string, mixed>  $rules
     * @param  array<string, mixed>  $cfg
     */
    private function computeServiceCharge(
        float $amount,
        string $applicationNature,
        float $serviceChargeRate,
        string $svcMode,
        array $rules,
        array $cfg
    ): float {
        if ($svcMode === 'fixed') {
            $new = (float) ($rules['service_charge_fixed_new'] ?? $cfg['service_charge_new_loan'] ?? 0);
            $reloan = (float) ($rules['service_charge_fixed_reloan'] ?? $rules['service_charge_fixed_new'] ?? $new);

            return $this->money($applicationNature === 'reloan' ? $reloan : $new);
        }

        return $this->money($amount * $serviceChargeRate);
    }

    /**
     * Official doc stamp pattern: Loan ÷ 200 × (multiplier default 1.5). Fallback: decimal rate per peso when configured.
     *
     * @param  array<string, mixed>  $rules
     */
    private function computeDocStamp(float $amount, array $rules): float
    {
        if (isset($rules['doc_stamp_per_200']) && $rules['doc_stamp_per_200'] !== '') {
            $per200 = (float) $rules['doc_stamp_per_200'];

            return $this->money(($amount / 200.0) * $per200);
        }
        $docStampRateDecimal = (float) ($rules['doc_stamp_rate_decimal'] ?? 0.0075);

        return $this->money($amount * $docStampRateDecimal);
    }

    /**
     * @param  array<string, mixed>  $cfg
     */
    private function resolveEffectiveTermMonths(LoanProduct $product, array $cfg, int $requestedTerm): int
    {
        $requestedTerm = max(1, $requestedTerm);
        $renewalMode = (string) ($cfg['term_structure'] ?? '');

        if ($product->slug === 'travel-assistance-loan' || $renewalMode === 'monthly_renewal') {
            return max(1, (int) ($cfg['fixed_term_months'] ?? 1));
        }

        return $requestedTerm;
    }

    /**
     * @param  array<string, mixed>  $input
     */
    private function resolveProduct(array $input): ?LoanProduct
    {
        if (! empty($input['product_id'])) {
            return LoanProduct::query()->find((int) $input['product_id']);
        }
        if (! empty($input['product_code'])) {
            return LoanProduct::query()->where('code', (string) $input['product_code'])->first();
        }
        if (! empty($input['product_slug'])) {
            return LoanProduct::query()->where('slug', (string) $input['product_slug'])->first();
        }

        return null;
    }

    private function resolveMonthlyRatePercent(LoanProduct $product, int $termMonths): float
    {
        $rate = (float) $product->interest_rate;
        if ($rate <= 0) {
            return 0.0;
        }
        if ($product->rate_type === 'annual') {
            return $this->money($rate / 12.0, 4);
        }
        if ($product->rate_type === 'fixed') {
            return $this->money($rate / max(1, $termMonths), 4);
        }

        return $this->money($rate, 4);
    }

    private function money(float $value, int $precision = 2): float
    {
        if (function_exists('bcadd')) {
            return (float) bcadd((string) $value, '0', $precision);
        }

        return round($value, $precision);
    }

    /**
     * @return array<int, array<string, float|int>>
     */
    private function buildStraightLineSchedule(
        float $amount,
        int $termMonths,
        float $monthlyPrincipal,
        float $monthlyInterest,
        float $monthlyAmortization
    ): array {
        $rows = [];
        $balance = $this->money($amount);
        $firstDue = new \DateTimeImmutable('first day of next month');

        for ($installment = 1; $installment <= $termMonths; $installment++) {
            $beginningBalance = $balance;
            $principal = $installment === $termMonths ? $this->money($balance) : $monthlyPrincipal;
            $interest = $monthlyInterest;
            $amortization = $this->money($principal + $interest);
            $endingBalance = $this->money(max(0, $beginningBalance - $principal));
            $due = $firstDue->modify('+'.($installment - 1).' months');

            $rows[] = [
                'installment_no' => $installment,
                'due_date' => $due->format('Y-m-d'),
                'beginning_balance' => $beginningBalance,
                'principal' => $principal,
                'interest' => $interest,
                'amortization' => $amortization,
                // Compatibility with the legacy SOA generator + payment ledger.
                'payment' => $amortization,
                'balance' => $endingBalance,
                'ending_balance' => $endingBalance,
            ];

            $balance = $endingBalance;
        }

        // Keep headline monthly amortization aligned with row values.
        if ($rows !== []) {
            $rows[0]['amortization'] = $monthlyAmortization;
        }

        return $rows;
    }
}
