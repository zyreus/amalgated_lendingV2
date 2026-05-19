<?php

namespace App\Support;

final class MailLogo
{
    /**
     * Readable logo file on disk (PNG preferred for email clients).
     */
    public static function path(): ?string
    {
        foreach ([
            public_path('amalgated-lending-logo.png'),
            public_path('amalgated-lending-logo.svg'),
            base_path('../frontend/src/assets/amalgated-lending-logo.png'),
        ] as $candidate) {
            if (is_readable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }

    /**
     * Public HTTPS/HTTP URL on the marketing site — not the API subdomain.
     */
    public static function publicUrl(): string
    {
        $configured = trim((string) config('services.borrower_verify.logo_url', ''));
        if ($configured !== '') {
            return $configured;
        }

        $filename = basename(self::path() ?? 'amalgated-lending-logo.png');

        foreach ([
            config('app.frontend_url'),
            config('services.borrower_verify.base_url'),
            config('lending.public_base_url'),
        ] as $base) {
            $base = trim((string) $base);
            if ($base === '' || self::looksLikeApiHost($base)) {
                continue;
            }

            return rtrim($base, '/').'/'.$filename;
        }

        return rtrim((string) config('app.url'), '/').'/'.$filename;
    }

    /**
     * Inline logo for previews and clients that accept data URIs.
     */
    public static function dataUri(): ?string
    {
        $path = self::path();
        if ($path === null) {
            return null;
        }

        $raw = @file_get_contents($path);
        if ($raw === false || $raw === '') {
            return null;
        }

        if (str_ends_with(strtolower($path), '.svg')) {
            return 'data:image/svg+xml;charset=utf-8,'.rawurlencode($raw);
        }

        return 'data:image/png;base64,'.base64_encode($raw);
    }

    /** Fallback when CID embed is unavailable (e.g. log driver). */
    public static function src(): string
    {
        return self::dataUri() ?? self::publicUrl();
    }

    /** Logo URL for browser pages served from Laravel (same host as /borrower/email/verify). */
    public static function pageLogoUrl(): string
    {
        $filename = basename(self::path() ?? 'amalgated-lending-logo.png');

        if (function_exists('request') && request()->getSchemeAndHttpHost()) {
            return request()->getSchemeAndHttpHost().'/'.$filename;
        }

        $base = rtrim((string) config('services.borrower_verify.base_url', ''), '/');
        if ($base !== '') {
            return $base.'/'.$filename;
        }

        return asset($filename);
    }

    private static function looksLikeApiHost(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);

        return is_string($host) && str_starts_with(strtolower($host), 'api.');
    }
}
