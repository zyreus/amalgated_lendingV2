<?php

/**
 * Browser origins allowed to call the Laravel API (Sanctum + JSON).
 *
 * Production: set FRONTEND_URL to your Vite SPA origin; optionally extend with CORS_ALLOWED_ORIGINS (comma-separated).
 * Local dev: FRONTEND_URL=http://localhost:5173 is included automatically when set in .env.
 */
$defaults = [
    'https://amalgatedlending.com',
    'https://www.amalgatedlending.com',
];

$fromEnvList = static function (?string $raw): array {
    if ($raw === null || $raw === '') {
        return [];
    }

    return array_values(array_filter(array_map(
        static fn (string $s): string => rtrim(trim($s), '/'),
        preg_split('/\s*,\s*/', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: []
    )));
};

$origins = array_merge(
    $defaults,
    $fromEnvList(env('CORS_ALLOWED_ORIGINS')),
);

$frontend = env('FRONTEND_URL');
if (is_string($frontend) && $frontend !== '') {
    $origins[] = rtrim($frontend, '/');
}

$origins = array_values(array_unique(array_filter($origins)));

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'borrower/email/verify'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
