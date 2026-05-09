<?php

namespace App\Services;

/**
 * Central entry point for loan math used by portals, public calculators, approvals, and SOA.
 * All product-specific formulas live in {@see LoanCalculator}; this engine exposes a stable API.
 */
final class LoanCalculationEngine
{
    public function __construct(private readonly LoanCalculator $calculator) {}

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function compute(array $input): array
    {
        return $this->calculator->compute($input);
    }

    /**
     * Legacy public-site fee_breakdown shape (matches former LoanProductFeeCalculator output).
     *
     * @param  array<string, mixed>  $compute  Result of {@see self::compute()}
     * @return array<string, mixed>
     */
    public function toPublicFeeBreakdown(array $compute): array
    {
        return $this->calculator->toLegacyPublicFeeBreakdown($compute);
    }
}
