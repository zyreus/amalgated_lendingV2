<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Transactional mail delivery (Google Workspace SMTP)
    |--------------------------------------------------------------------------
    */

    'retry_attempts' => max(1, (int) env('MAIL_RETRY_ATTEMPTS', 3)),

    'retry_delay_ms' => max(100, (int) env('MAIL_RETRY_DELAY_MS', 750)),

    'rate_limit_per_minute' => max(1, (int) env('MAIL_RATE_LIMIT_PER_MINUTE', 40)),

    'queue_transactional' => filter_var(env('MAIL_QUEUE_TRANSACTIONAL', false), FILTER_VALIDATE_BOOL),

    'fallback_mailer' => env('MAIL_FALLBACK_MAILER', 'log'),

  /*
  |--------------------------------------------------------------------------
  | Dev-only log fallback
  |--------------------------------------------------------------------------
  |
  | When true (default outside production), failed SMTP attempts may write to
  | the log mailer so local dev without Gmail still shows "ok". Never enabled
  | in production — callers must see real SMTP failures.
  |
  */
    'allow_log_fallback' => filter_var(
        env('MAIL_ALLOW_LOG_FALLBACK', env('APP_ENV', 'production') !== 'production'),
        FILTER_VALIDATE_BOOL
    ),

];
