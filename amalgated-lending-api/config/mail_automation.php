<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Staff alert recipients (comma-separated). Used when no admin users match.
    |--------------------------------------------------------------------------
    */
    'staff_alert_emails' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('MAIL_STAFF_ALERTS', 'support@amalgatedlending.com'))
    ))),

    'staff_email_enabled' => filter_var(env('MAIL_STAFF_ALERTS_ENABLED', true), FILTER_VALIDATE_BOOL),

    'public_ack_enabled' => filter_var(env('MAIL_PUBLIC_ACK_ENABLED', true), FILTER_VALIDATE_BOOL),

    /*
    |--------------------------------------------------------------------------
    | Payment reminder email — days before due date to notify (comma-separated).
    |--------------------------------------------------------------------------
    */
    'payment_reminder_days_before' => array_values(array_filter(array_map(
        'intval',
        explode(',', (string) env('MAIL_PAYMENT_REMINDER_DAYS', '1,3,5'))
    ))),

    'payment_overdue_email_enabled' => filter_var(env('MAIL_PAYMENT_OVERDUE_ENABLED', true), FILTER_VALIDATE_BOOL),

    /*
    |--------------------------------------------------------------------------
    | Borrower login OTP (email-based).
    |--------------------------------------------------------------------------
    */
    'otp_enabled' => filter_var(env('MAIL_OTP_ENABLED', true), FILTER_VALIDATE_BOOL),

    'otp_ttl_seconds' => max(120, (int) env('MAIL_OTP_TTL_SECONDS', 300)),

    'otp_cooldown_seconds' => max(30, (int) env('MAIL_OTP_COOLDOWN_SECONDS', 60)),

    'otp_length' => max(4, min(8, (int) env('MAIL_OTP_LENGTH', 6))),

];
