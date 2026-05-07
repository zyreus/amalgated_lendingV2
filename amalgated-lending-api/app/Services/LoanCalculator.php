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
        $monthlyRatePercent = $this->resolveMonthlyRatePercent($product, $term);

        $age = isset($input['age']) ? (int) $input['age'] : null;
        if ($age !== null && $product->age_limit !== null && $age > (int) $product->age_limit) {
            throw ValidationException::withMessages([
                'age' => ['Borrower age exceeds the allowed product age limit.'],
            ]);
        }

        if ($product->slug === 'sss-pension-loan') {
            $monthlyPension = (float) ($input['monthly_pension'] ?? 0);
            if ($monthlyPension <= 0) {
                throw ValidationException::withMessages([
                    'monthly_pension' => ['Monthly pension is required for SSS/GSIS pension loans.'],
                ]);
            }
            $multiplier = (float) ($cfg['pension_multiplier'] ?? 18.75);
            $pensionMax = $this->money($monthlyPension * $multiplier);
            if ($amount > $pensionMax) {
                throw ValidationException::withMessages([
                    'loan_amount' => ['Loan amount exceeds pension-based limit of ₱'.number_format($pensionMax, 2).'.'],
                ]);
            }
        }

        $serviceChargeRate = (float) ($rules['service_charge_rate'] ?? 0.035);
        $insurancePerThousand = (float) ($rules['insurance_per_1000'] ?? $cfg['insurance_per_1000'] ?? 35.0);
        $insuranceFixed = (float) ($rules['insurance_fixed'] ?? 2000.0);
        $docStampRateDecimal = (float) ($rules['doc_stamp_rate_decimal'] ?? 0.0075);
        $mortgageRate = (float) ($rules['mortgage_fee_rate'] ?? 0.025);
        $mortgageThreshold = (float) ($rules['mortgage_fee_threshold'] ?? 200000.0);
        $notarialNew = (float) ($rules['notarial_fee_new'] ?? $cfg['notarial_new_loan'] ?? 1500.0);
        $notarialReloan = (float) ($rules['notarial_fee_reloan'] ?? $cfg['notarial_reloan'] ?? $notarialNew);

        $serviceCharge = $this->money($amount * $serviceChargeRate);
        $insurance = $this->money(($amount / 1000.0) * $insurancePerThousand + $insuranceFixed);
        $docStamp = $this->money($amount * $docStampRateDecimal);
        $notarialFee = $this->money($applicationNature === 'reloan' ? $notarialReloan : $notarialNew);

        $isMortgageProduct = in_array($product->slug, ['real-estate-mortgage', 'chattel-mortgage'], true);
        $mortgageFee = $this->money($isMortgageProduct && $amount >= $mortgageThreshold ? $amount * $mortgageRate : 0.0);

        $monthlyPrincipal = $this->money($amount / $term);
        $monthlyInterest = $this->money($amount * ($monthlyRatePercent / 100.0));
        $monthlyAmortization = $this->money($monthlyPrincipal + $monthlyInterest);
        $totalMiscFees = $this->money($serviceCharge + $insurance + $docStamp + $notarialFee + $mortgageFee);
        $netProceeds = $this->money($amount - $totalMiscFees);
        $totalAddOnInterest = $this->money($monthlyInterest * $term);
        $totalPayable = $this->money($monthlyAmortization * $term);

        $renewalMode = (string) ($cfg['term_structure'] ?? '');
        if ($product->slug === 'travel-assistance-loan' || $renewalMode === 'monthly_renewal') {
            $term = (int) ($cfg['fixed_term_months'] ?? 1);
        }

        $schedule = $this->buildStraightLineSchedule($amount, $term, $monthlyPrincipal, $monthlyInterest, $monthlyAmortization);

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
                $product->slug === 'travel-assistance-loan' ? 'Travel assistance uses monthly renewal logic (default 1-month cycle).' : null,
                $product->slug === 'salary-loan' ? 'Salary loans are commonly settled through salary deduction arrangements.' : null,
                $product->slug === 'sss-pension-loan' ? 'Pensioner loan uses pension multiplier and age policy checks.' : null,
            ])),
            'raw_rules' => [
                'service_charge_rate' => $serviceChargeRate,
                'insurance_per_1000' => $insurancePerThousand,
                'insurance_fixed' => $insuranceFixed,
                'doc_stamp_rate_decimal' => $docStampRateDecimal,
                'mortgage_fee_rate' => $mortgageRate,
                'mortgage_fee_threshold' => $mortgageThreshold,
            ],
        ];
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

        for ($installment = 1; $installment <= $termMonths; $installment++) {
            $beginningBalance = $balance;
            $principal = $installment === $termMonths ? $this->money($balance) : $monthlyPrincipal;
            $interest = $monthlyInterest;
            $amortization = $this->money($principal + $interest);
            $endingBalance = $this->money(max(0, $beginningBalance - $principal));

            $rows[] = [
                'installment_no' => $installment,
                'beginning_balance' => $beginningBalance,
                'principal' => $principal,
                'interest' => $interest,
                'amortization' => $amortization,
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
