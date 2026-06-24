<?php

namespace App\Support;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Helpers to build and clear named HTTP rate limiter keys after authentication.
 */
class AuthRateLimit
{
    public const ADMIN_LOGIN = 'auth-admin-login';

    public const BORROWER_LOGIN = 'auth-borrower-login';

    public const GENERIC_LOGIN = 'auth-login';

    public const OTP_VERIFY = 'auth-otp-verify';

    public const PASSWORD_RESET = 'auth-password-reset';

    public const REGISTER = 'auth-register';

    /** Lockout window after too many failed auth attempts (login / forgot password). */
    public const LOCKOUT_DECAY_SECONDS = 30;

    public const LOGIN_MAX_ATTEMPTS = 5;

    public const PASSWORD_RESET_MAX_ATTEMPTS = 5;

    /** @var list<string> */
    public const ALL_LIMITERS = [
        self::ADMIN_LOGIN,
        self::BORROWER_LOGIN,
        self::GENERIC_LOGIN,
        self::OTP_VERIFY,
        self::PASSWORD_RESET,
        self::REGISTER,
    ];

    public static function resolveLoginIdentifier(Request $request): string
    {
        return trim((string) ($request->input('username')
            ?: $request->input('email')
            ?: $request->input('identifier')
            ?: ''));
    }

    public static function loginKey(Request $request, ?string $login = null): string
    {
        $resolved = mb_strtolower(trim($login ?? self::resolveLoginIdentifier($request)));
        $ip = (string) $request->ip();

        return $resolved !== '' ? $resolved.'|'.$ip : $ip;
    }

    public static function clearNamed(string $limiterName, string $by): void
    {
        if ($by === '') {
            return;
        }

        // Named limiter keys match ThrottleRequests (hashed by default in Laravel 10+).
        RateLimiter::clear(md5($limiterName.$by));
        RateLimiter::clear($limiterName.':'.$by);
    }

    public static function clearLimiter(string $limiterName, Request $request, ?string $login = null): void
    {
        $key = self::loginKey($request, $login);
        self::clearNamed($limiterName, $key);
        // Legacy IP-only buckets from earlier deployments.
        self::clearNamed($limiterName, (string) $request->ip());
    }

    public static function clearAdminLogin(Request $request, ?string $username = null): void
    {
        self::clearLimiter(self::ADMIN_LOGIN, $request, $username);
        self::clearLimiter(self::GENERIC_LOGIN, $request, $username);
    }

    public static function clearBorrowerLogin(Request $request, ?string $identifier = null): void
    {
        self::clearLimiter(self::BORROWER_LOGIN, $request, $identifier);
        self::clearLimiter(self::GENERIC_LOGIN, $request, $identifier);
    }

    public static function clearLogin(Request $request, ?string $username = null): void
    {
        self::clearLimiter(self::GENERIC_LOGIN, $request, $username);
    }

    public static function clearOtpVerify(Request $request, ?string $username = null): void
    {
        self::clearLimiter(self::OTP_VERIFY, $request, $username);
        self::clearBorrowerLogin($request, $username);
    }

    public static function clearPasswordReset(Request $request, ?string $email = null): void
    {
        self::clearLimiter(self::PASSWORD_RESET, $request, $email);
    }

    /**
     * Clear all known auth throttle buckets for troubleshooting.
     */
    public static function clearAllFor(Request $request, ?string $login = null): void
    {
        $ip = (string) $request->ip();
        $key = self::loginKey($request, $login);

        foreach (self::ALL_LIMITERS as $limiter) {
            self::clearNamed($limiter, $key);
            self::clearNamed($limiter, $ip);
        }
    }
}
