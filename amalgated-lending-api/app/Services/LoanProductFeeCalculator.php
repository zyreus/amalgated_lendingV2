<?php

namespace App\Services;

use App\Models\LoanProduct;

/**
 * @deprecated Prefer {@see LoanCalculationEngine} + {@see LoanCalculator}. Kept for backward compatibility.
 */
class LoanProductFeeCalculator
{
    public static function travel(float $la): array
    {
        $product = LoanProduct::query()->active()->where('slug', 'travel-assistance-loan')->first();
        if (! $product) {
            return self::travelFallback($la);
        }
        $engine = app(LoanCalculationEngine::class);
        $compute = $engine->compute([
            'product_id' => $product->id,
            'loan_amount' => $la,
            'term_months' => max(1, (int) (($product->calculator_config ?? [])['fixed_term_months'] ?? 1)),
            'application_nature' => 'new',
        ]);

        return $engine->toPublicFeeBreakdown($compute);
    }

    public static function mortgage(float $la, int $term, float $monthlyRatePercent): array
    {
        unset($monthlyRatePercent);
        $product = LoanProduct::query()->active()->whereIn('slug', ['real-estate-mortgage', 'chattel-mortgage'])->orderBy('sort_order')->first();
        if (! $product) {
            return [];
        }
        $engine = app(LoanCalculationEngine::class);
        $compute = $engine->compute([
            'product_id' => $product->id,
            'loan_amount' => $la,
            'term_months' => max(1, $term),
            'application_nature' => 'new',
        ]);

        return $engine->toPublicFeeBreakdown($compute);
    }

    /**
     * @param  array<string, mixed>  $cfg
     * @return array<string, mixed>
     */
    public static function pension(float $la, int $term, float $monthlyRatePercent, array $cfg): array
    {
        unset($monthlyRatePercent, $cfg);
        $product = LoanProduct::query()->active()->where('slug', 'sss-pension-loan')->first();
        if (! $product) {
            return [];
        }
        $engine = app(LoanCalculationEngine::class);
        $compute = $engine->compute([
            'product_id' => $product->id,
            'loan_amount' => $la,
            'term_months' => max(1, $term),
            'application_nature' => 'new',
        ]);

        return $engine->toPublicFeeBreakdown($compute);
    }

    private static function travelFallback(float $la): array
    {
        $sc = round($la * 0.035, 2);
        $ds = round($la / 200 * 1.5, 2);
        $mi = round($la * 0.035, 2);
        $totalMisc = round($sc + $ds + $mi, 2);

        return [
            'service_charge' => $sc,
            'doc_stamp' => $ds,
            'monthly_interest_component' => $mi,
            'total_miscellaneous_one_time' => $totalMisc,
            'opening_account_landbank' => 10000,
            'estimated_client_cash_requirement' => round(10000 + $totalMisc, 2),
            'disclaimer' => 'Miscellaneous fees are intended as one-time charges (not deducted from loan); opening a Landbank account (≈₱10,000) is shouldered by the client. Confirm with the branch.',
        ];
    }
}
