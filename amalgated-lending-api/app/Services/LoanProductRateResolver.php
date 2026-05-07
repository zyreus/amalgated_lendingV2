<?php

namespace App\Services;

use App\Models\LoanProduct;

/**
 * Resolves quoting interest rates from `loan_products` (slug + optional term),
 * mirroring legacy apply flows (monthly add-on disclosed as nominal annual ×12 on the Loan row).
 */
class LoanProductRateResolver
{
    /**
     * Per-slug fallback monthly % used when DB row missing or unusable — keep in sync with product-specific apply endpoints.
     */
    public static function fallbackMonthlyPercentForSlug(?string $slug): ?float
    {
        if ($slug === null || $slug === '') {
            return null;
        }

        return match ($slug) {
            'chattel-mortgage',
            'real-estate-mortgage' => 3.88,
            'salary-loan' => 1.5,
            'travel-assistance-loan' => 3.5,
            'sss-pension-loan' => 2.24,
            default => null,
        };
    }

    /**
     * Effective monthly percentage for amortisation (additive monthly % convention used across public apply flows).
     */
    public function resolveMonthlyRatePercent(string $slug, float $fallback, ?int $termMonths = null): float
    {
        $product = LoanProduct::query()->where('slug', $slug)->first();
        if (! $product) {
            return $fallback;
        }
        $rate = (float) $product->interest_rate;
        if ($rate <= 0) {
            return $fallback;
        }
        if ((string) $product->rate_type === 'annual') {
            return $rate / 12;
        }
        if ((string) $product->rate_type === 'fixed') {
            $months = max(1, (int) ($termMonths ?? 1));

            return $rate / $months;
        }

        return $rate;
    }

    /** Stored `loans.annual_interest_rate` used by amortisation/display (typically monthly additive ×12). */
    public function resolveAnnualStoredPercent(string $slug, float $fallbackMonthlyPercent, ?int $termMonths = null): float
    {
        $monthly = $this->resolveMonthlyRatePercent($slug, $fallbackMonthlyPercent, $termMonths);

        return round($monthly * 12.0, 4);
    }
}
