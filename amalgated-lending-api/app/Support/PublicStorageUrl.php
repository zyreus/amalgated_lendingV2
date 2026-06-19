<?php

namespace App\Support;

use Illuminate\Support\Facades\URL;

/**
 * Resolves public disk file paths to stable application URLs.
 *
 * JSON APIs return same-origin {@see self::apiUrl} (`/api/v1/public-files/...`) so the SPA
 * (Vite dev server, Apache, or CDN) does not depend on `APP_URL` matching the browser host.
 * Server-rendered views and email use {@see self::absoluteUrl} via `url()`.
 */
final class PublicStorageUrl
{
    /** @var list<string> */
    private const SENSITIVE_PREFIXES = [
        'borrower-documents/',
        'borrower-selfies/',
        'borrower-id-docs/',
        'borrower-receipts/',
        'documents/',
        'signatures/',
        'lead-chat/',
        'loan-applications/',
    ];

    public static function apiUrl(?string $stored): ?string
    {
        $rel = self::normalizeStoredPath($stored);
        if ($rel === null || $rel === '') {
            return null;
        }

        if (self::isSensitivePath($rel)) {
            return self::signedApiUrl($rel);
        }

        $segments = explode('/', $rel);
        $encoded = implode('/', array_map('rawurlencode', $segments));

        return '/api/v1/public-files/'.$encoded;
    }

    public static function isSensitivePath(?string $stored): bool
    {
        $rel = self::normalizeStoredPath($stored);
        if ($rel === null || $rel === '') {
            return false;
        }

        foreach (self::SENSITIVE_PREFIXES as $prefix) {
            if (str_starts_with($rel, $prefix)) {
                return true;
            }
        }

        return false;
    }

    public static function signedApiUrl(?string $stored, int $minutes = 45): ?string
    {
        $rel = self::normalizeStoredPath($stored);
        if ($rel === null || $rel === '') {
            return null;
        }

        return URL::temporarySignedRoute(
            'api.public-files.show',
            now()->addMinutes($minutes),
            ['path' => $rel],
            false,
        );
    }

    public static function absoluteUrl(?string $stored): ?string
    {
        $api = self::apiUrl($stored);
        if ($api === null) {
            return null;
        }

        return url($api);
    }

    /**
     * Mirror a stored-path tree (e.g. loan application `documents` JSON) with signed API URLs.
     *
     * @return array<string, mixed>
     */
    public static function mapPathTree(mixed $node): array
    {
        if (! is_array($node)) {
            return [];
        }

        $out = [];
        foreach ($node as $key => $value) {
            if (is_string($value) && $value !== '') {
                $out[$key] = self::apiUrl($value);
            } elseif (is_array($value)) {
                $urls = [];
                foreach ($value as $path) {
                    if (is_string($path) && $path !== '') {
                        $urls[] = self::apiUrl($path);
                    }
                }
                $out[$key] = $urls;
            }
        }

        return $out;
    }

    /**
     * Path relative to the `public` disk root (`storage/app/public`), safe for `Storage::disk('public')`.
     */
    public static function normalizeStoredPath(?string $stored): ?string
    {
        if ($stored === null) {
            return null;
        }

        $s = trim(str_replace('\\', '/', (string) $stored));
        if ($s === '') {
            return null;
        }

        if (preg_match('#^https?://#i', $s)) {
            $path = (string) (parse_url($s, PHP_URL_PATH) ?? '');

            if (preg_match('#/api/v1/public-files/(.+)$#i', $path, $m)) {
                return self::sanitizeRelative(rawurldecode($m[1]));
            }
            if (preg_match('#/storage/(.+)$#i', $path, $m)) {
                return self::sanitizeRelative($m[1]);
            }

            return null;
        }

        if (str_starts_with($s, '/api/v1/public-files/')) {
            $rest = substr($s, strlen('/api/v1/public-files/'));

            return self::sanitizeRelative(rawurldecode($rest));
        }

        // Absolute filesystem path → extract segment after `storage/app/public/`.
        $markers = ['storage/app/public/', '/storage/app/public/'];
        foreach ($markers as $marker) {
            $pos = stripos($s, $marker);
            if ($pos !== false) {
                return self::sanitizeRelative(substr($s, $pos + strlen($marker)));
            }
        }

        $markers2 = ['public/storage/', '/public/storage/'];
        foreach ($markers2 as $marker) {
            $pos = stripos($s, $marker);
            if ($pos !== false) {
                return self::sanitizeRelative(substr($s, $pos + strlen($marker)));
            }
        }

        $s = preg_replace('#^(?:storage/app/public/|public/storage/|public/)#i', '', $s) ?? $s;
        $s = ltrim($s, '/');

        return self::sanitizeRelative($s);
    }

    private static function sanitizeRelative(string $path): ?string
    {
        $path = trim($path, '/');
        if ($path === '') {
            return null;
        }
        if (str_contains($path, '..')) {
            return null;
        }

        return $path;
    }
}
