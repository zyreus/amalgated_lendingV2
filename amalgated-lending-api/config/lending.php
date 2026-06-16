<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Optional absolute base for signed print URLs (/print/*)
    |--------------------------------------------------------------------------
    |
    | Signed print links use path-only HMACs, so they work on any host. When
    | this is set (e.g. http://127.0.0.1:8000), generated links are absolute
    | for opening in a new tab or copying outside the SPA. Leave empty to
    | return paths only (/print/...), which work with the Vite dev proxy.
    |
    */
    'public_base_url' => env('LENDING_PUBLIC_BASE_URL'),
];
