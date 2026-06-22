<?php

namespace App\Support;

use App\Models\Payment;
use App\Models\User;

/** Resolve the borrower profile email used for payment receipts and confirmations. */
final class BorrowerContactEmail
{
    public static function isValid(?string $email): bool
    {
        $trimmed = trim((string) ($email ?? ''));

        return $trimmed !== '' && filter_var($trimmed, FILTER_VALIDATE_EMAIL);
    }

    public static function forUser(?User $user): string
    {
        $email = trim((string) ($user?->email ?? ''));

        return self::isValid($email) ? $email : '';
    }

    public static function forPayment(Payment $payment): string
    {
        $payment->loadMissing(['loan.borrower']);

        $fromUser = self::forUser($payment->loan?->borrower);
        if ($fromUser !== '') {
            return $fromUser;
        }

        $payload = is_array($payment->loan?->application_payload) ? $payment->loan->application_payload : [];
        foreach (['email', 'borrower_email', 'contact_email'] as $key) {
            $candidate = trim((string) ($payload[$key] ?? ''));
            if (self::isValid($candidate)) {
                return $candidate;
            }
        }

        return '';
    }
}
