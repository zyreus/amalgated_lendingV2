<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class BorrowerOtpService
{
    public function __construct(
        private readonly EmailAutomationService $automation,
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
        if (Cache::has($cooldownKey)) {
            $ttl = (int) Cache::get($cooldownKey.'_ttl', config('mail_automation.otp_cooldown_seconds', 60));

            return ['ok' => false, 'message' => 'Please wait before requesting another code.', 'cooldown_seconds' => $ttl];
        }

        $length = (int) config('mail_automation.otp_length', 6);
        $code = '';
        for ($i = 0; $i < $length; $i++) {
            $code .= (string) random_int(0, 9);
        }

        $ttl = (int) config('mail_automation.otp_ttl_seconds', 600);
        Cache::put('borrower_otp:'.$user->id, Hash::make($code), $ttl);
        Cache::put($cooldownKey, 1, (int) config('mail_automation.otp_cooldown_seconds', 60));
        Cache::put($cooldownKey.'_ttl', (int) config('mail_automation.otp_cooldown_seconds', 60), (int) config('mail_automation.otp_cooldown_seconds', 60));

        $expiresMinutes = (int) ceil($ttl / 60);
        $send = $this->automation->sendBorrowerOtp($user, $code, $expiresMinutes);
        if (! ($send['ok'] ?? false)) {
            $detail = (string) ($send['detail'] ?? '');
            $hint = $detail === 'smtp_not_configured'
                ? 'Email is not configured on the server (MAIL_*).'
                : ($detail !== '' ? 'Mail error: '.$detail : 'Could not send OTP email.');

            return ['ok' => false, 'message' => $hint.' Try again later.'];
        }

        return ['ok' => true, 'message' => 'A sign-in code was sent to '.$email.'.'];
    }

    public function verifyCode(User $user, string $code): bool
    {
        $stored = Cache::get('borrower_otp:'.$user->id);
        if (! is_string($stored) || $stored === '') {
            return false;
        }

        $normalized = preg_replace('/\D+/', '', $code) ?? '';
        if ($normalized === '' || ! Hash::check($normalized, $stored)) {
            return false;
        }

        Cache::forget('borrower_otp:'.$user->id);

        return true;
    }

    public function resolveUserByLogin(string $login): ?User
    {
        $lower = mb_strtolower(trim($login));

        return User::query()
            ->where(function ($q) use ($lower) {
                $q->whereRaw('LOWER(username) = ?', [$lower])
                    ->orWhereRaw('LOWER(email) = ?', [$lower]);
            })
            ->first();
    }
}
