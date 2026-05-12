<?php

namespace App\Services;

use App\Models\Payment;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * OR/AR normalization, uniqueness (active rows), and validation for confirmed payments.
 */
class PaymentReceiptComplianceService
{
    public function normalize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $t = strtoupper(preg_replace('/\s+/', '', trim($value)));

        return $t === '' ? null : $t;
    }

    /**
     * @param  bool  $requireAtLeastOne  When true (e.g. confirming paid), at least one of OR or AR must be present.
     *
     * @throws ValidationException
     */
    public function validateReceiptFormat(?string $or, ?string $ar, bool $requireAtLeastOne = false): void
    {
        $rules = [
            'official_receipt_number' => ['nullable', 'string', 'max:64', 'regex:/^[A-Z0-9\-._\/#]+$/'],
            'acknowledgement_receipt_number' => ['nullable', 'string', 'max:64', 'regex:/^[A-Z0-9\-._\/#]+$/'],
        ];

        $validator = Validator::make([
            'official_receipt_number' => $or,
            'acknowledgement_receipt_number' => $ar,
        ], $rules, [
            'official_receipt_number.regex' => 'Official receipt number may only contain letters, digits, and -._/#',
            'acknowledgement_receipt_number.regex' => 'Acknowledgement receipt number may only contain letters, digits, and -._/#',
        ]);

        if ($requireAtLeastOne) {
            $validator->after(function (\Illuminate\Validation\Validator $v) use ($or, $ar): void {
                $hasOr = $or !== null && $or !== '';
                $hasAr = $ar !== null && $ar !== '';
                if (! $hasOr && ! $hasAr) {
                    $v->errors()->add(
                        'official_receipt_number',
                        'Provide at least an Official Receipt (OR) number or an Acknowledgement Receipt (AR) number.'
                    );
                }
            });
        }

        $validator->validate();
    }

    /**
     * @throws ValidationException
     */
    public function assertUniqueOfficialReceipt(?string $or, ?int $exceptPaymentId): void
    {
        if ($or === null || $or === '') {
            return;
        }
        $q = Payment::withTrashed()->where('official_receipt_number', $or);
        if ($exceptPaymentId) {
            $q->whereKeyNot($exceptPaymentId);
        }
        if ($q->exists()) {
            throw ValidationException::withMessages([
                'official_receipt_number' => ['This Official Receipt number is already assigned to another payment.'],
            ]);
        }
    }

    /**
     * @throws ValidationException
     */
    public function assertUniqueAcknowledgementReceipt(?string $ar, ?int $exceptPaymentId): void
    {
        if ($ar === null || $ar === '') {
            return;
        }
        $q = Payment::withTrashed()->where('acknowledgement_receipt_number', $ar);
        if ($exceptPaymentId) {
            $q->whereKeyNot($exceptPaymentId);
        }
        if ($q->exists()) {
            throw ValidationException::withMessages([
                'acknowledgement_receipt_number' => ['This Acknowledgement Receipt number is already assigned to another payment.'],
            ]);
        }
    }

    public function nextOfficialReceiptSequence(int $year): int
    {
        $like = 'OR-'.$year.'-%';
        $max = 0;
        $values = Payment::withTrashed()
            ->where('official_receipt_number', 'like', $like)
            ->pluck('official_receipt_number');
        foreach ($values as $col) {
            if (! is_string($col) || $col === '') {
                continue;
            }
            if (preg_match('/^OR-'.preg_quote((string) $year, '/').'-(\d+)$/', $col, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return $max + 1;
    }

    public function nextAcknowledgementReceiptSequence(int $year): int
    {
        $like = 'AR-'.$year.'-%';
        $max = 0;
        $values = Payment::withTrashed()
            ->where('acknowledgement_receipt_number', 'like', $like)
            ->pluck('acknowledgement_receipt_number');
        foreach ($values as $col) {
            if (! is_string($col) || $col === '') {
                continue;
            }
            if (preg_match('/^AR-'.preg_quote((string) $year, '/').'-(\d+)$/', $col, $m)) {
                $max = max($max, (int) $m[1]);
            }
        }

        return $max + 1;
    }

    public function mintOfficialReceiptNumber(?int $exceptPaymentId = null): string
    {
        $year = (int) now()->format('Y');
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $seq = $this->nextOfficialReceiptSequence($year) + $attempt;
            $candidate = 'OR-'.$year.'-'.str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
            if (! Payment::withTrashed()->where('official_receipt_number', $candidate)->when(
                $exceptPaymentId,
                fn ($q) => $q->whereKeyNot($exceptPaymentId)
            )->exists()) {
                $this->assertUniqueOfficialReceipt($candidate, $exceptPaymentId);

                return $candidate;
            }
        }

        return 'OR-'.$year.'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
    }

    public function mintAcknowledgementReceiptNumber(?int $exceptPaymentId = null): string
    {
        $year = (int) now()->format('Y');
        for ($attempt = 0; $attempt < 50; $attempt++) {
            $seq = $this->nextAcknowledgementReceiptSequence($year) + $attempt;
            $candidate = 'AR-'.$year.'-'.str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
            if (! Payment::withTrashed()->where('acknowledgement_receipt_number', $candidate)->when(
                $exceptPaymentId,
                fn ($q) => $q->whereKeyNot($exceptPaymentId)
            )->exists()) {
                $this->assertUniqueAcknowledgementReceipt($candidate, $exceptPaymentId);

                return $candidate;
            }
        }

        return 'AR-'.$year.'-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT);
    }
}
