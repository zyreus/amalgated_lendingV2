<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class BorrowerOtpService
{
    public function __construct(
        private readonly EmailAutomationService $automation,
        private readonly SmsOtpService $sms,
    ) {}

    /**
     * @return array{ok: bool, message?: string, cooldown_seconds?: int}
     */
    public function requestCode(User $user): array
    {
        if (! config('mail_automation.otp_enabled', true)) {
            return ['ok' => false, 'message' => 'Email OTP is not enabled.'];
        }

        $email = mb_strtolower(trim((string) $user->email));
        $cooldownKey = 'borrower_otp_cooldown:'.$user->id;
        if ((int) ($user->otp_resend_attempts ?? 0) >= 5 && $user->otp_last_sent_at?->isToday()) {
            $user->forceFill(['borrower_status' => 'blocked'])->save();

            return ['ok' => false, 'message' => 'Maximum OTP resend attempts reached. Please contact support.'];
        }
        if (Cache::has($cooldownKey)) {
            $fallback = (int) Cache::get($cooldownKey.'_ttl', config('mail_automation.otp_cooldown_seconds', 60));
            $ttl = $user->otp_last_sent_at
                ? max(1, (int) now()->diffInSeconds($user->otp_last_sent_at->copy()->addSeconds((int) config('mail_automation.otp_cooldown_seconds', 60)), false))
                : $fallback;

            return ['ok' => false, 'message' => 'Please wait before requesting another code.', 'cooldown_seconds' => $ttl];
        }

        $length = (int) config('mail_automation.otp_length', 6);
        $code = '';
        for ($i = 0; $i < $length; $i++) {
            $code .= (string) random_int(0, 9);
        }

        $ttl = (int) config('mail_automation.otp_ttl_seconds', 300);
        $hash = Hash::make($code);
        Cache::put('borrower_otp:'.$user->id, $hash, $ttl);
        Cache::put($cooldownKey, 1, (int) config('mail_automation.otp_cooldown_seconds', 60));
        Cache::put($cooldownKey.'_ttl', (int) config('mail_automation.otp_cooldown_seconds', 60), (int) config('mail_automation.otp_cooldown_seconds', 60));
        $user->forceFill([
            'otp_code' => $hash,
            'otp_expiration' => now()->addSeconds($ttl),
            'verification_attempts' => 0,
            'otp_resend_attempts' => (int) ($user->otp_resend_attempts ?? 0) + 1,
            'otp_last_sent_at' => now(),
        ])->save();

        $expiresMinutes = (int) ceil($ttl / 60);
        $sms = $this->sms->sendBorrowerOtp($user, $code, $expiresMinutes);
        $mail = $this->automation->sendBorrowerOtp($user, $code, $expiresMinutes);

        $smsOk = (bool) ($sms['ok'] ?? false);
        $mailOk = (bool) ($mail['ok'] ?? false);
        if ($smsOk && $mailOk) {
            return [
                'ok' => true,
                'message' => 'A 6-digit verification code was sent by SMS to '.$this->maskPhone((string) $user->phone).' and to '.$email.'.',
            ];
        }
        if ($smsOk) {
            return [
                'ok' => true,
                'message' => 'A 6-digit verification code was sent by SMS to '.$this->maskPhone((string) $user->phone).'.',
            ];
        }
        if ($mailOk) {
            $smsDetail = (string) ($sms['detail'] ?? '');

            return [
                'ok' => true,
                'message' => $smsDetail !== '' && ! in_array($smsDetail, ['sms_disabled', 'missing_phone'], true)
                    ? 'A 6-digit verification code was sent to '.$email.'. SMS delivery failed: '.$this->smsFailureMessage($smsDetail).'.'
                    : 'A 6-digit verification code was sent to '.$email.'.',
            ];
        }

        $mailDetail = (string) ($mail['detail'] ?? '');
        $smsDetail = (string) ($sms['detail'] ?? '');
        $hint = $mailDetail === 'smtp_not_configured'
            ? 'Email is not configured on the server (MAIL_*).'
            : ($mailDetail !== '' ? 'Mail error: '.$mailDetail : 'Could not send OTP email.');
        if ($smsDetail !== '') {
            $hint = 'SMS error: '.$this->smsFailureMessage($smsDetail).'. '.$hint;
        }

        return ['ok' => false, 'message' => $hint.' Try again later.'];
    }

    public function verifyCode(User $user, string $code): bool
    {
        $stored = Cache::get('borrower_otp:'.$user->id);
        if (! is_string($stored) || $stored === '') {
            $stored = (string) ($user->otp_code ?? '');
        }
        if (! is_string($stored) || $stored === '') {
            return false;
        }
        if ($user->otp_expiration instanceof Carbon && $user->otp_expiration->isPast()) {
            $this->clearCode($user);

            return false;
        }

        $normalized = preg_replace('/\D+/', '', $code) ?? '';
        if ($normalized === '' || ! Hash::check($normalized, $stored)) {
            $attempts = (int) ($user->verification_attempts ?? 0) + 1;
            $updates = ['verification_attempts' => $attempts];
            if ($attempts >= (int) config('mail_automation.otp_max_verify_attempts', 5)) {
                $updates['borrower_status'] = 'blocked';
            }
            $user->forceFill($updates)->save();

            return false;
        }

        $this->clearCode($user);

        return true;
    }

    public function resolveUserByLogin(string $login): ?User
    {
        $lower = mb_strtolower(trim($login));
        $phone = self::normalizePhone($login);

        return User::query()
            ->where(function ($q) use ($lower, $phone) {
                $q->whereRaw('LOWER(username) = ?', [$lower])
                    ->orWhereRaw('LOWER(email) = ?', [$lower]);
                if ($phone !== '') {
                    $q->orWhere('phone', $phone);
                }
            })
            ->first();
    }

    public static function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '63') && strlen($digits) === 12) {
            return '0'.substr($digits, 2);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 10) {
            return '0'.$digits;
        }

        return $digits;
    }

    private function maskPhone(string $phone): string
    {
        $normalized = self::normalizePhone($phone);
        if (strlen($normalized) < 7) {
            return 'your phone number';
        }

        return substr($normalized, 0, 4).str_repeat('*', max(0, strlen($normalized) - 7)).substr($normalized, -3);
    }

    private function smsFailureMessage(string $detail): string
    {
        return match ($detail) {
            'semaphore_account_not_approved_or_no_credits' => 'Semaphore account is not approved yet or has no SMS credits',
            'semaphore_ssl_certificate_error' => 'local SMS SSL certificate verification failed',
            'semaphore_not_configured' => 'Semaphore API key is not configured',
            'missing_phone' => 'borrower phone number is missing or invalid',
            default => $detail,
        };
    }

    private function clearCode(User $user): void
    {
        Cache::forget('borrower_otp:'.$user->id);
        $user->forceFill([
            'otp_code' => null,
            'otp_expiration' => null,
            'verification_attempts' => 0,
        ])->save();
    }
}
