<?php

namespace App\Services;

/**
 * Illustrative fee schedules from business rules (REM/CHM, Travel, SSS/GSIS pension).
 * Final amounts are subject to branch verification.
 */
class LoanProductFeeCalculator
{
    public static function travel(float $la): array
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
            'disclaimer' => 'Miscellaneous fees are intended as one-time charges (not deducted from loan); opening a Landbank account (≈₱10,000) is shouldered by the client. Confirm with the branch.',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function mortgage(float $la, int $term, float $monthlyRatePercent): array
    {
        $term = max(1, $term);
        $sc = round($la * 0.035, 2);
        $ins = round($la / 1000 * 35 + 2000, 2);
        $ds = round($la / 200 * 1.5, 2);
        $notarial = 1500.0;
        $mortgageFee = round($la * 0.025, 2);
        $mp = round($la / $term, 2);
        $mi = round($la * ($monthlyRatePercent / 100), 2);
        $mort = round($mp + $mi, 2);
        $feeSum = $sc + $ins + $ds + $notarial + $mortgageFee;
        $net = round($la - $feeSum, 2);

        return [
            'service_charge' => $sc,
            'insurance' => $ins,
            'doc_stamp' => $ds,
            'notarial_fee' => $notarial,
            'mortgage_fee' => $mortgageFee,
            'mortgage_fee_note' => 'Mortgage fee is 2.5% of loan amount per company policy.',
            'monthly_principal' => $mp,
            'monthly_interest_on_full_principal' => $mi,
            'monthly_amortization_straight_line' => $mort,
            'total_miscellaneous' => round($feeSum, 2),
            'net_proceeds_after_misc' => $net,
            'reminders' => [
                'Clean title; prefer no annotation.',
                'Disclose existing loans with other banks/lenders.',
                'Avoid extrajudicial / heir disputes where possible.',
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $cfg
     * @return array<string, mixed>
     */
    public static function pension(float $la, int $term, float $monthlyRatePercent, array $cfg): array
    {
        $term = max(1, $term);
        $svc = (float) ($cfg['service_charge_new_loan'] ?? 2750);
        $ins = round($la / 1000 * (float) ($cfg['insurance_per_1000'] ?? 35), 2);
        $notarial = (float) ($cfg['notarial_new_loan'] ?? 350);
        $ds = round($la / 200 * 1.5, 2);
        $mp = round($la / $term, 2);
        $mi = round($la * ($monthlyRatePercent / 100), 2);
        $mort = round($mp + $mi, 2);
        $feeSum = $svc + $ins + $notarial + $ds;
        $net = round($la - $feeSum, 2);

        return [
            'service_charge_new_loan' => $svc,
            'insurance' => $ins,
            'notarial_fee' => $notarial,
            'doc_stamp' => $ds,
            'monthly_principal' => $mp,
            'monthly_interest_on_full_principal' => $mi,
            'monthly_amortization' => $mort,
            'total_miscellaneous' => round($feeSum, 2),
            'net_proceeds_after_misc' => $net,
        ];
    }
}
