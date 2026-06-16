<?php

namespace App\Support;

use DateInterval;
use DateTimeInterface;
use Illuminate\Support\Facades\URL;

final class SignedPrintUrls
{
    /**
     * Temporary signed URL for HTML print routes (general/travel loan, SOA).
     *
     * Uses path-only signing ($absolute = false) so the HMAC matches on any
     * host/port (e.g. 127.0.0.1:8000, Vite proxy on :5173). Returns a path
     * like `/print/loan-soa/6?expires=…&signature=…`.
     *
     * Optional `lending.public_base_url` prepends an absolute origin for
     * clients that need a full URL (e.g. copy/paste outside the SPA).
     */
    public static function temporaryRoute(string $name, DateTimeInterface|DateInterval|int $expiration, array $parameters = []): string
    {
        $path = URL::temporarySignedRoute($name, $expiration, $parameters, false);
        $base = config('lending.public_base_url');
        $base = is_string($base) ? rtrim(trim($base), '/') : '';

        if ($base !== '') {
            return $base.$path;
        }

        return $path;
    }
}
