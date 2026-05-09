<?php

namespace App\Services;

use App\Models\LoanProduct;
use Illuminate\Validation\ValidationException;

class LoanCalculator
{
    public function __construct(
        private readonly LoanAmortizationService $amortization,
    ) {}

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

        $cfg = is_array($product->calculator_config) ? $product->calculator_config : [];
        $rules = is_array($product->rules) ? $product->rules : [];

        $applianceMeta = null;
        if ($product->slug === 'appliance') {
            $srp = isset($input['srp']) ? (float) $input['srp'] : null;
            if ($srp !== null && $srp > 0) {
                $channel = (string) ($input['purchase_channel'] ?? $rules['default_purchase_channel'] ?? 'outside_office');
                $dpRate = $channel === 'outside_office'
                    ? (float) ($rules['outside_office_downpayment_rate'] ?? 0.15)
                    : (float) ($rules['in_office_downpayment_rate'] ?? 0);
                $dp = $this->money($srp * $dpRate);
                $amount = $this->money($srp - $dp);
                $applianceMeta = [
                    'srp' => $this->money($srp),
                    'purchase_channel' => $channel,
                    'downpayment_rate' => $dpRate,
                    'downpayment_amount' => $dp,
                ];
            }
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

        $term = $this->resolveEffectiveTermMonths($product, $cfg, $term);

        $monthlyRatePercent = isset($input['monthly_rate_percent_override']) && (float) $input['monthly_rate_percent_override'] > 0
            ? $this->money((float) $input['monthly_rate_percent_override'], 4)
            : $this->resolveMonthlyRatePercent($product, $term);

        $age = isset($input['age']) ? (int) $input['age'] : null;
        if ($age !== null && $product->age_limit !== null && $age > (int) $product->age_limit) {
            throw ValidationException::withMessages([
                'age' => ['Borrower age exceeds the allowed product age limit.'],
            ]);
        }

        if ($product->slug === 'sss-pension-loan') {
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
        $isMortgageProduct = in_array($product->slug, ['real-estate-mortgage', 'chattel-mortgage'], true);
        $mortgageRate = (float) ($rules['mortgage_fee_rate'] ?? ($isMortgageProduct ? 0.02 : 0.0));
        $mortgageThreshold = (float) ($rules['mortgage_fee_threshold'] ?? 0);
        $notarialNew = (float) ($rules['notarial_fee_new'] ?? $cfg['notarial_new_loan'] ?? 1500.0);
        $notarialReloan = (float) ($rules['notarial_fee_reloan'] ?? $cfg['notarial_reloan'] ?? $notarialNew);
        if ($product->slug === 'salary-loan') {
            $notarialNew = (float) ($rules['notarial_fee_new'] ?? 350.0);
            $notarialReloan = (float) ($rules['notarial_fee_reloan'] ?? $notarialNew);
        } elseif ($isMortgageProduct) {
            $notarialNew = (float) ($rules['notarial_fee_new'] ?? 1500.0);
            $notarialReloan = (float) ($rules['notarial_fee_reloan'] ?? 175.0);
        }

        $serviceCharge = $this->computeServiceCharge($amount, $applicationNature, $serviceChargeRate, $svcMode, $rules, $cfg);
        $insurance = $feeProfile === 'travel'
            ? 0.0
            : $this->money(($amount / 1000.0) * $insurancePerThousand + $insuranceFixed);
        $docStamp = $this->computeDocStamp($amount, $rules);
        $notarialFee = $this->money($applicationNature === 'reloan' ? $notarialReloan : $notarialNew);

        $mortgageFee = $this->money(
            $isMortgageProduct && $amount >= $mortgageThreshold ? $amount * $mortgageRate : 0.0
        );

        $reLoanFee = 0.0;
        if ($isMortgageProduct && $applicationNature === 'reloan') {
            $reLoanFee = $this->money(max(0.0, (float) ($rules['re_loan_fee'] ?? 0)));
        }

        $compStyle = (string) ($cfg['computation_style'] ?? 'straight_line');
        $useAmortized = $compStyle === 'amortized'
            && $product->slug !== 'travel-assistance-loan'
            && $feeProfile !== 'travel';

        if ($useAmortized) {
            $annualRatePercent = $this->money($monthlyRatePercent * 12.0, 6);
            $built = $this->amortization->buildSchedule($amount, $annualRatePercent, $term);
            $schedule = $this->mapAmortizedSchedule($amount, $built['rows'] ?? []);
            $monthlyAmortization = $this->money((float) ($built['monthly_payment'] ?? 0));
            $totalAddOnInterest = $this->money((float) ($built['total_interest'] ?? 0));
            $totalPayable = $this->money(array_sum(array_map(fn ($r) => (float) ($r['payment'] ?? 0), $schedule)));
            $first = $schedule[0] ?? null;
            $monthlyPrincipal = $first ? $this->money((float) ($first['principal'] ?? 0)) : $this->money($amount / max(1, $term));
            $monthlyInterest = $first ? $this->money((float) ($first['interest'] ?? 0)) : 0.0;
        } else {
            $monthlyPrincipal = $this->money($amount / max(1, $term));
            $monthlyInterest = $this->money($amount * ($monthlyRatePercent / 100.0));
            $monthlyAmortization = $this->money($monthlyPrincipal + $monthlyInterest);
            $totalAddOnInterest = $this->money($monthlyInterest * $term);
            $totalPayable = $this->money($monthlyAmortization * $term);
            $schedule = $this->buildStraightLineSchedule($amount, $term, $monthlyPrincipal, $monthlyInterest, $monthlyAmortization);
        }

        if ($useAmortized && $amount > 0.00001) {
            $wholeTermInterestPercent = $this->money(($totalAddOnInterest / $amount) * 100, 4);
        } else {
            $wholeTermInterestPercent = $this->money($monthlyRatePercent * $term, 4);
        }

        $totalMiscFees = $this->money($serviceCharge + $insurance + $docStamp + $notarialFee + $mortgageFee + $reLoanFee);
        $netProceeds = $miscDeductedFromProceeds ? $this->money($amount - $totalMiscFees) : $this->money($amount);

        $openingAccountFee = ($product->slug === 'travel-assistance-loan')
            ? (float) ($rules['opening_account_fee'] ?? $cfg['opening_account_fee'] ?? 10000)
            : 0.0;

        $travelMiscSubtotal = 0.0;
        $clientCashRequirement = 0.0;
        if ($product->slug === 'travel-assistance-loan') {
            $travelMiscSubtotal = $this->money($serviceCharge + $docStamp + $monthlyInterest);
            $clientCashRequirement = $this->money($openingAccountFee + $travelMiscSubtotal);
        }

        $adjustedRate = isset($input['monthly_rate_percent_override']) && (float) $input['monthly_rate_percent_override'] > 0
            ? $this->money((float) $input['monthly_rate_percent_override'], 4)
            : null;

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
            'inputs' => array_filter([
                'loan_amount' => $this->money($amount),
                'term_months' => $term,
                'application_nature' => $applicationNature,
                'age' => $age,
                'monthly_pension' => isset($input['monthly_pension']) ? $this->money((float) $input['monthly_pension']) : null,
                'computation_style_used' => $useAmortized ? 'amortized' : 'straight_line',
                'appliance' => $applianceMeta,
            ], fn ($v) => $v !== null),
            'breakdown' => array_filter([
                'service_charge' => $serviceCharge,
                'insurance' => $insurance,
                'documentary_stamp' => $docStamp,
                'doc_stamp' => $docStamp,
                'notarial_fee' => $notarialFee,
                'mortgage_fee' => $mortgageFee,
                're_loan_fee' => $reLoanFee > 0 ? $reLoanFee : null,
                'opening_account_fee' => $openingAccountFee > 0 ? $this->money($openingAccountFee) : null,
                'travel_miscellaneous_subtotal' => $product->slug === 'travel-assistance-loan' ? $travelMiscSubtotal : null,
                'estimated_client_cash_requirement' => $product->slug === 'travel-assistance-loan' ? $clientCashRequirement : null,
                'miscellaneous_deducted_from_proceeds' => $miscDeductedFromProceeds,
                'monthly_principal' => $monthlyPrincipal,
                'monthly_interest' => $monthlyInterest,
                'monthly_amortization' => $monthlyAmortization,
                'whole_term_interest_percent' => $wholeTermInterestPercent,
                'total_add_on_interest' => $totalAddOnInterest,
                'total_interest' => $totalAddOnInterest,
                'total_payable' => $totalPayable,
                'total_payment' => $totalPayable,
                'total_miscellaneous_fees' => $totalMiscFees,
                'total_charges' => $totalMiscFees,
                'total_deductions' => $totalMiscFees,
                'mri_fee' => $insurance,
                'net_proceeds' => $netProceeds,
                'adjusted_monthly_rate_percent' => $adjustedRate,
            ], fn ($v) => $v !== null),
            'summary' => [
                'loan_amount' => $this->money($amount),
                'term_months' => $term,
                'monthly_rate_percent_effective' => $this->money($monthlyRatePercent, 4),
                'whole_term_interest_percent' => $wholeTermInterestPercent,
                'total_add_on_interest' => $totalAddOnInterest,
                'total_interest' => $totalAddOnInterest,
                'total_payable' => $totalPayable,
                'total_payment' => $totalPayable,
                'total_miscellaneous_fees' => $totalMiscFees,
                'total_charges' => $totalMiscFees,
                'total_deductions' => $totalMiscFees,
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
                $useAmortized ? 'Amortization uses standard monthly reducing balance on the approved principal.' : null,
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
     * @param  array<string, mixed>  $compute
     * @return array<string, mixed>
     */
    public function toLegacyPublicFeeBreakdown(array $compute): array
    {
        $slug = (string) (($compute['product'] ?? [])['slug'] ?? '');
        $b = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [];

        if ($slug === 'travel-assistance-loan') {
            $misc = (float) ($b['travel_miscellaneous_subtotal'] ?? 0);
            $opening = (float) ($b['opening_account_fee'] ?? 10000);

            return [
                'service_charge' => (float) ($b['service_charge'] ?? 0),
                'doc_stamp' => (float) ($b['doc_stamp'] ?? $b['documentary_stamp'] ?? 0),
                'monthly_interest_component' => (float) ($b['monthly_interest'] ?? 0),
                'total_miscellaneous_one_time' => $this->money($misc),
                'opening_account_landbank' => $opening,
                'estimated_client_cash_requirement' => (float) ($b['estimated_client_cash_requirement'] ?? $this->money($opening + $misc)),
                'disclaimer' => 'Miscellaneous fees are intended as one-time charges (not deducted from loan); opening a Landbank account (≈₱10,000) is shouldered by the client. Confirm with the branch.',
            ];
        }

        if (in_array($slug, ['real-estate-mortgage', 'chattel-mortgage'], true)) {
            $reloan = (float) ($b['re_loan_fee'] ?? 0);
            $raw = is_array($compute['raw_rules'] ?? null) ? $compute['raw_rules'] : [];
            $mfRate = (float) ($raw['mortgage_fee_rate'] ?? 0.02);
            $mfPct = $this->money($mfRate * 100, 2);

            return [
                'service_charge' => (float) ($b['service_charge'] ?? 0),
                'insurance' => (float) ($b['insurance'] ?? 0),
                'mri_fee' => (float) ($b['mri_fee'] ?? $b['insurance'] ?? 0),
                'doc_stamp' => (float) ($b['doc_stamp'] ?? $b['documentary_stamp'] ?? 0),
                'notarial_fee' => (float) ($b['notarial_fee'] ?? 0),
                're_loan_fee' => $reloan > 0 ? $reloan : null,
                'mortgage_fee' => (float) ($b['mortgage_fee'] ?? 0),
                'mortgage_fee_note' => 'Mortgage fee is '.$mfPct.'% of loan amount per policy.',
                'whole_term_interest_percent' => (float) ($b['whole_term_interest_percent'] ?? 0),
                'monthly_principal' => (float) ($b['monthly_principal'] ?? 0),
                'monthly_interest_on_full_principal' => (float) ($b['monthly_interest'] ?? 0),
                'monthly_amortization_straight_line' => (float) ($b['monthly_amortization'] ?? 0),
                'total_interest' => (float) ($b['total_interest'] ?? $b['total_add_on_interest'] ?? 0),
                'total_payment' => (float) ($b['total_payment'] ?? $b['total_payable'] ?? 0),
                'total_miscellaneous' => (float) ($b['total_miscellaneous_fees'] ?? 0),
                'total_deductions' => (float) ($b['total_deductions'] ?? $b['total_miscellaneous_fees'] ?? 0),
                'net_proceeds_after_misc' => (float) ($b['net_proceeds'] ?? 0),
                'reminders' => [
                    'Clean title; prefer no annotation.',
                    'Disclose existing loans with other banks/lenders.',
                    'Avoid extrajudicial / heir disputes where possible.',
                ],
            ];
        }

        if ($slug === 'sss-pension-loan') {
            return [
                'service_charge_new_loan' => (float) ($b['service_charge'] ?? 0),
                'insurance' => (float) ($b['insurance'] ?? 0),
                'notarial_fee' => (float) ($b['notarial_fee'] ?? 0),
                'doc_stamp' => (float) ($b['doc_stamp'] ?? $b['documentary_stamp'] ?? 0),
                'monthly_principal' => (float) ($b['monthly_principal'] ?? 0),
                'monthly_interest_on_full_principal' => (float) ($b['monthly_interest'] ?? 0),
                'monthly_amortization' => (float) ($b['monthly_amortization'] ?? 0),
                'total_miscellaneous' => (float) ($b['total_miscellaneous_fees'] ?? 0),
                'net_proceeds_after_misc' => (float) ($b['net_proceeds'] ?? 0),
            ];
        }

        return [
            'service_charge' => (float) ($b['service_charge'] ?? 0),
            'insurance' => (float) ($b['insurance'] ?? 0),
            'doc_stamp' => (float) ($b['doc_stamp'] ?? $b['documentary_stamp'] ?? 0),
            'notarial_fee' => (float) ($b['notarial_fee'] ?? 0),
            'mortgage_fee' => (float) ($b['mortgage_fee'] ?? 0),
            'monthly_principal' => (float) ($b['monthly_principal'] ?? 0),
            'monthly_interest_on_full_principal' => (float) ($b['monthly_interest'] ?? 0),
            'monthly_amortization_straight_line' => (float) ($b['monthly_amortization'] ?? 0),
            'total_miscellaneous' => (float) ($b['total_miscellaneous_fees'] ?? 0),
            'net_proceeds_after_misc' => (float) ($b['net_proceeds'] ?? 0),
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
     * @param  array<int, array<string, float|int|string>>  $rows
     * @return array<int, array<string, float|int|string>>
     */
    private function mapAmortizedSchedule(float $initialPrincipal, array $rows): array
    {
        $balance = $this->money($initialPrincipal);
        $out = [];

        foreach ($rows as $r) {
            $beginning = $balance;
            $p = (float) ($r['principal'] ?? 0);
            $int = (float) ($r['interest'] ?? 0);
            $pay = (float) ($r['payment'] ?? 0);
            $end = (float) ($r['balance'] ?? 0);

            $out[] = [
                'installment_no' => (int) ($r['installment_no'] ?? count($out) + 1),
                'due_date' => (string) ($r['due_date'] ?? ''),
                'beginning_balance' => $this->money($beginning),
                'principal' => $p,
                'interest' => $int,
                'amortization' => $pay,
                'payment' => $pay,
                'balance' => $end,
                'ending_balance' => $end,
            ];

            $balance = $end;
        }

        return $out;
    }

    /**
     * @return array<int, array<string, float|int|string>>
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
                'payment' => $amortization,
                'balance' => $endingBalance,
                'ending_balance' => $endingBalance,
            ];

            $balance = $endingBalance;
        }

        if ($rows !== []) {
            $rows[0]['amortization'] = $monthlyAmortization;
        }

        return $rows;
    }
}
