<?php

namespace App\Services;

use App\Models\LoanProduct;
use Illuminate\Validation\ValidationException;

/**
 * Derives maximum pension loan principal from monthly pension capacity rules.
 */
class PensionLoanCapacityService
{
    public function __construct(
        private LoanCalculator $calculator,
        private LoanProductRateResolver $rateResolver,
    ) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function estimateFromPension(LoanProduct $product, array $input): array
    {
        $monthlyPension = (float) ($input['monthly_pension'] ?? 0);
        $termMonths = max(1, (int) ($input['term_months'] ?? 1));
        $applicationNature = (string) ($input['application_nature'] ?? 'new');
        $pensionType = isset($input['pension_type']) ? (string) $input['pension_type'] : null;

        if ($monthlyPension <= 0) {
            return $this->emptyPreview($termMonths, $monthlyPension);
        }

        $principal = $this->resolveMaxLoanablePrincipal($product, $monthlyPension, $termMonths, $applicationNature, $pensionType);
        if ($principal <= 0) {
            return $this->emptyPreview($termMonths, $monthlyPension, ineligible: true);
        }

        try {
            $compute = $this->calculator->compute([
                'product_id' => $product->id,
                'loan_amount' => $principal,
                'term_months' => $termMonths,
                'application_nature' => $applicationNature,
                'monthly_pension' => $monthlyPension,
                'pension_type' => $pensionType,
            ]);
        } catch (ValidationException $e) {
            $flat = collect($e->errors())->flatten()->values()->all();

            return array_merge($this->emptyPreview($termMonths, $monthlyPension, ineligible: true), [
                'eligible' => false,
                'validation_errors' => $flat,
                'message' => $flat[0] ?? 'Pension capacity check failed.',
            ]);
        }

        $breakdown = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [];

        return [
            'eligible' => (bool) ($breakdown['pension_compliance_ok'] ?? true),
            'estimated_loanable_amount' => $principal,
            'loan_amount' => $principal,
            'monthly_pension' => round($monthlyPension, 2),
            'term_months' => $termMonths,
            'monthly_principal' => (float) ($breakdown['monthly_principal'] ?? 0),
            'monthly_interest' => (float) ($breakdown['monthly_interest'] ?? 0),
            'monthly_amortization' => (float) ($breakdown['monthly_amortization'] ?? 0),
            'monthly_deduction' => (float) ($breakdown['monthly_amortization'] ?? 0),
            'remaining_pension' => (float) ($breakdown['remaining_pension'] ?? 0),
            'minimum_remaining_pension' => (float) ($breakdown['pension_retention_threshold'] ?? 0),
            'maximum_deduction_allowed' => round(max(0, $monthlyPension - (float) ($breakdown['pension_retention_threshold'] ?? 0)), 2),
            'computation' => $compute,
        ];
    }

    public function resolveMaxLoanablePrincipal(
        LoanProduct $product,
        float $monthlyPension,
        int $termMonths,
        string $applicationNature = 'new',
        ?string $pensionType = null,
    ): float {
        if ($monthlyPension <= 0) {
            return 0.0;
        }

        $cfg = is_array($product->calculator_config) ? $product->calculator_config : [];
        $rules = is_array($product->rules) ? $product->rules : [];
        $termMonths = max(1, $termMonths);

        $normalizedNature = in_array(strtolower(trim($applicationNature)), ['reloan', 'rl'], true) ? 'reloan' : 'new';
        $pensionSystem = $this->resolvePensionSystem($pensionType, $rules);
        $minRemaining = $this->resolveMinRemainingPension($rules, $normalizedNature, $pensionSystem);

        $maxDeduction = $monthlyPension - $minRemaining;
        if ($maxDeduction <= 0) {
            return 0.0;
        }

        $monthlyRatePercent = $this->rateResolver->resolveMonthlyRatePercent(
            (string) $product->slug,
            LoanProductRateResolver::fallbackMonthlyPercentForSlug($product->slug) ?? (float) $product->interest_rate,
            $termMonths,
        );
        $factor = (1.0 / $termMonths) + ($monthlyRatePercent / 100.0);
        if ($factor <= 0) {
            return 0.0;
        }

        $capacityPrincipal = $maxDeduction / $factor;

        $multiplier = (float) ($cfg['pension_multiplier'] ?? 18.75);
        $multiplierCap = $monthlyPension * $multiplier;

        $caps = array_filter([
            $capacityPrincipal,
            $multiplierCap > 0 ? $multiplierCap : null,
            ! empty($cfg['max_principal']) ? (float) $cfg['max_principal'] : null,
            $product->max_amount !== null && (float) $product->max_amount > 0 ? (float) $product->max_amount : null,
        ], fn ($v) => $v !== null && (float) $v > 0);

        if ($caps === []) {
            return 0.0;
        }

        $principal = min($caps);
        if (! empty($cfg['min_principal']) && $principal < (float) $cfg['min_principal']) {
            return 0.0;
        }

        return round(floor($principal * 100) / 100, 2);
    }

    /**
     * @return array<string, mixed>
     */
    private function emptyPreview(int $termMonths, float $monthlyPension, bool $ineligible = false): array
    {
        return [
            'eligible' => false,
            'estimated_loanable_amount' => 0,
            'loan_amount' => 0,
            'monthly_pension' => round($monthlyPension, 2),
            'term_months' => $termMonths,
            'monthly_principal' => 0,
            'monthly_interest' => 0,
            'monthly_amortization' => 0,
            'monthly_deduction' => 0,
            'remaining_pension' => round($monthlyPension, 2),
            'minimum_remaining_pension' => null,
            'maximum_deduction_allowed' => null,
            'message' => $ineligible ? 'Pension capacity is insufficient for the selected term.' : 'Enter monthly pension to see your estimated loanable amount.',
        ];
    }

  private function resolvePensionSystem(?string $pensionType, array $rules): string
    {
        $type = strtoupper(trim((string) ($pensionType ?? '')));
        if (in_array($type, ['SSS', 'GSIS'], true)) {
            return $type;
        }

        $default = strtoupper(trim((string) ($rules['default_pension_system'] ?? 'SSS')));

        return in_array($default, ['SSS', 'GSIS'], true) ? $default : 'SSS';
    }

    private function resolveMinRemainingPension(array $rules, string $nature, string $pensionSystem): float
    {
        $suffix = strtolower($pensionSystem);
        $natureKey = $nature === 'reloan' ? 'rl' : 'nw';
        $specific = $rules["pension_retention_threshold_{$natureKey}_{$suffix}"]
            ?? $rules["pension_retention_threshold_{$suffix}"]
            ?? null;

        if ($specific !== null && $specific !== '') {
            return max(0.0, (float) $specific);
        }

        return max(0.0, (float) ($rules['pension_retention_threshold'] ?? 1000.0));
    }
}
