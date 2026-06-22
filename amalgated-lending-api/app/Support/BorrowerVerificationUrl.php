<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

final class BorrowerVerificationUrl
{
    /** Production public site — fallback when env still points at loopback. */
    private const PRODUCTION_PUBLIC_ORIGIN = 'https://amalgatedlending.com';

    /**
     * Borrower login URL on the SPA. Uses FRONTEND_URL in production; aligns localhost/127.0.0.1 only in local dev.
     */
    public static function borrowerLoginUrl(Request $request, array $params = []): string
    {
        $base = self::frontendLoginBase();

        if (self::allowLocalHostAlignment()) {
            $verifyBase = rtrim((string) config('services.borrower_verify.base_url', ''), '/');
            $requestOrigin = $request->getSchemeAndHttpHost();
            if (
                $verifyBase !== ''
                && self::isLoopbackUrl($verifyBase)
                && str_starts_with($verifyBase, $requestOrigin)
                && self::originKey($base) !== self::originKey($verifyBase)
                && self::originKey($requestOrigin) === self::originKey($verifyBase)
            ) {
                $base = $requestOrigin;
            }

            $base = self::alignHostWithRequest($request, $base);
        }

        $path = '/'.ltrim((string) config('services.borrower_verify.login_path', '/login'), '/');
        $query = http_build_query(array_filter($params, static fn ($v) => $v !== null && $v !== ''));

        return $query !== '' ? "{$base}{$path}?{$query}" : "{$base}{$path}";
    }

    public static function signedVerifyUrl(User $user): string
    {
        $hours = max(1, min(720, (int) config('services.borrower_verify.expires_hours', 168)));
        $base = rtrim(self::publicBaseUrlForEmail(), '/');

        $appUrl = rtrim((string) config('app.url'), '/');
        URL::forceRootUrl($base);

        try {
            $relative = URL::temporarySignedRoute(
                'borrower.email.verify',
                now()->addHours($hours),
                [
                    'id' => $user->getKey(),
                    'hash' => sha1((string) $user->getEmailForVerification()),
                ],
                false,
            );
        } finally {
            if ($appUrl !== '') {
                URL::forceRootUrl($appUrl);
            }
        }

        return $base.$relative;
    }

    /**
     * Canonical verify path on the public origin (for legacy redirects).
     */
    public static function canonicalVerifyUrl(int $id, string $hash, array $queryParams = []): string
    {
        $base = rtrim(self::publicBaseUrl(), '/');
        $path = "/borrower/email/verify/{$id}/{$hash}";
        $query = http_build_query(array_filter($queryParams, static fn ($v) => $v !== null && $v !== ''));

        return $query !== '' ? "{$base}{$path}?{$query}" : "{$base}{$path}";
    }

    /**
     * Origin borrowers click in email — public site (FRONTEND_URL / BORROWER_VERIFY_URL_BASE), never loopback in production.
     */
    public static function publicBaseUrl(): string
    {
        $candidates = [
            trim((string) config('services.borrower_verify.base_url', '')),
            trim((string) config('app.frontend_url', '')),
            trim((string) config('app.url', '')),
        ];

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }
            if (! self::allowLocalHostAlignment() && self::isLoopbackUrl($candidate)) {
                continue;
            }

            return self::ensureHttps($candidate);
        }

        if (! self::allowLocalHostAlignment()) {
            return self::PRODUCTION_PUBLIC_ORIGIN;
        }

        return self::ensureHttps('http://localhost');
    }

    /**
     * Public marketing site for outbound email CTAs (e.g. newsletter "Visit our website").
     */
    public static function marketingSiteUrlForEmail(): string
    {
        return rtrim(self::publicBaseUrlForEmail(), '/');
    }

    /**
     * Origin embedded in outbound verification emails — never loopback or api.* (mobile inboxes cannot reach dev machine).
     */
    public static function publicBaseUrlForEmail(): string
    {
        $candidates = [
            trim((string) config('services.borrower_verify.base_url', '')),
            trim((string) config('app.frontend_url', '')),
            trim((string) config('lending.public_base_url', '')),
            trim((string) config('app.url', '')),
        ];

        foreach ($candidates as $candidate) {
            if (self::isUnusablePublicOrigin($candidate)) {
                continue;
            }

            return rtrim(self::ensureHttps($candidate), '/');
        }

        return self::PRODUCTION_PUBLIC_ORIGIN;
    }

    private static function frontendLoginBase(): string
    {
        $frontend = trim((string) config('app.frontend_url', ''));
        if ($frontend !== '' && (self::allowLocalHostAlignment() || ! self::isLoopbackUrl($frontend))) {
            return rtrim(self::ensureHttps($frontend), '/');
        }

        $verifyBase = trim((string) config('services.borrower_verify.base_url', ''));
        if ($verifyBase !== '' && (self::allowLocalHostAlignment() || ! self::isLoopbackUrl($verifyBase))) {
            return rtrim(self::ensureHttps($verifyBase), '/');
        }

        if (! self::allowLocalHostAlignment()) {
            return self::PRODUCTION_PUBLIC_ORIGIN;
        }

        return rtrim(self::ensureHttps((string) config('app.url', 'http://localhost')), '/');
    }

    private static function allowLocalHostAlignment(): bool
    {
        if (app()->environment('local', 'testing')) {
            return true;
        }

        $appUrl = trim((string) config('app.url', ''));

        return $appUrl === '' || self::isLoopbackUrl($appUrl);
    }

    private static function isLoopbackUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['host'])) {
            return false;
        }

        $host = strtolower((string) $parts['host']);

        return in_array($host, ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'], true);
    }

    private static function looksLikeApiHost(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && str_starts_with(strtolower($host), 'api.');
    }

    private static function isUnusablePublicOrigin(string $url): bool
    {
        return $url === '' || self::isLoopbackUrl($url) || self::looksLikeApiHost($url);
    }

    private static function originKey(string $url): string
    {
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['host'])) {
            return $url;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? 'http'));
        $host = strtolower((string) $parts['host']);
        $port = $parts['port'] ?? ($scheme === 'https' ? 443 : 80);

        return "{$scheme}://{$host}:{$port}";
    }

    private static function alignHostWithRequest(Request $request, string $url): string
    {
        $host = $request->getHost();
        if ($host === '127.0.0.1' && str_contains($url, '://localhost')) {
            return preg_replace('#://localhost(?=[:/])#', '://127.0.0.1', $url, 1) ?? $url;
        }
        if ($host === 'localhost' && str_contains($url, '://127.0.0.1')) {
            return preg_replace('#://127\.0\.0\.1(?=[:/])#', '://localhost', $url, 1) ?? $url;
        }

        return $url;
    }

    private static function ensureHttps(string $url): string
    {
        if (app()->environment('production') && str_starts_with(strtolower($url), 'http://')) {
            return 'https://'.substr($url, 7);
        }

        if (
            ! self::allowLocalHostAlignment()
            && ! self::isLoopbackUrl($url)
            && str_starts_with(strtolower($url), 'http://')
        ) {
            return 'https://'.substr($url, 7);
        }

        return $url;
    }
}
