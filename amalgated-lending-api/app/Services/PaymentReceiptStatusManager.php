<?php

namespace App\Services;

use App\Models\Payment;

/**
 * Derives {@see Payment::$receipt_status} from receipt coverage, verification, and financial approval.
 */
final class PaymentReceiptStatusManager
{
    public function compute(Payment $payment): string
    {
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        $ar = trim((string) ($payment->acknowledgement_receipt_number ?? ''));
        $hasOr = $or !== '';
        $hasAr = $ar !== '';

        $coverageRank = match (true) {
            ! $hasOr && ! $hasAr => 1,
            $hasOr && $hasAr => 3,
            default => 2,
        };

        $rank = $coverageRank;
        if ($payment->verified_at) {
            $rank = max($rank, 4);
        }
        $statusLower = strtolower((string) ($payment->status ?? ''));
        if ($statusLower === Payment::STATUS_PAID && $payment->approved_at) {
            $rank = max($rank, 5);
        }

        return match ($rank) {
            5 => Payment::RECEIPT_STATUS_APPROVED,
            4 => Payment::RECEIPT_STATUS_VERIFIED,
            3 => Payment::RECEIPT_STATUS_FULLY_RECEIPTED,
            2 => Payment::RECEIPT_STATUS_PARTIAL_RECEIPT,
            default => Payment::RECEIPT_STATUS_PENDING,
        };
    }

    /**
     * Human-readable coverage for UI (independent of verification rank).
     */
    public function documentCoverageLabel(Payment $payment): string
    {
        $or = trim((string) ($payment->official_receipt_number ?? ''));
        $ar = trim((string) ($payment->acknowledgement_receipt_number ?? ''));

        return match (true) {
            $or !== '' && $ar !== '' => 'both',
            $or !== '' => 'or_only',
            $ar !== '' => 'ar_only',
            default => 'none',
        };
    }
}
