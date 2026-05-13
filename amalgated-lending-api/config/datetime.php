<?php

/**
 * Display vs persistence conventions.
 *
 * - Keep `config('app.timezone')` as UTC so Carbon/Eloquent serialize consistently for APIs and queues.
 * - Use `display_timezone` for Filament, exports, and human-facing copy (Philippines operations).
 */
return [

    'display_timezone' => env('APP_DISPLAY_TIMEZONE', 'Asia/Manila'),

    /**
     * When true, API resources may append ISO8601 with offset for display fields only.
     * Primary DB columns should remain plain UTC timestamps unless you standardize on timestamptz (PostgreSQL).
     */
    'expose_display_zoned_iso_in_api' => (bool) env('API_INCLUDE_DISPLAY_TZ_ISO', false),

];
