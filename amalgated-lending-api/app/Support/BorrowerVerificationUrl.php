<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;

final class BorrowerVerificationUrl
{
    /**
     * Borrower login URL on the SPA, with the same host family as the verify request
     * (127.0.0.1 vs localhost) so local redirects are not dropped by the browser.
     */
    public static function borrowerLoginUrl(Request $request, array $params = []): string
    {
        $base = rtrim((string) config('app.frontend_url', ''), '/');
        if ($base === '') {
            $base = rtrim((string) config('services.borrower_verify.base_url', ''), '/');
        }
        $base = self::alignHostWithRequest($request, $base);
        $path = '/'.ltrim((string) config('services.borrower_verify.login_path', '/borrower/login'), '/');
        $query = http_build_query(array_filter($params, static fn ($v) => $v !== null && $v !== ''));

        return $query !== '' ? "{$base}{$path}?{$query}" : "{$base}{$path}";
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

    public static function signedVerifyUrl(User $user): string
    {
        $hours = max(1, min(720, (int) config('services.borrower_verify.expires_hours', 168)));
        $base = rtrim(self::publicBaseUrl(), '/');

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
     * Origin borrowers click in email — public site (FRONTEND_URL), not the API subdomain.
     */
    private static function publicBaseUrl(): string
    {
        $configured = trim((string) config('services.borrower_verify.base_url', ''));
        if ($configured !== '') {
            return self::ensureHttps($configured);
        }

        $frontend = trim((string) config('app.frontend_url', ''));
        if ($frontend !== '') {
            return self::ensureHttps($frontend);
        }

        return self::ensureHttps((string) config('app.url', 'http://localhost'));
    }

    private static function ensureHttps(string $url): string
    {
        if (app()->environment('production') && str_starts_with(strtolower($url), 'http://')) {
            return 'https://'.substr($url, 7);
        }

        return $url;
    }
}
