<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
        'endpoint' => env('MAILGUN_ENDPOINT', 'api.mailgun.net'),
        'scheme' => 'https',
    ],

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    | Brevo (https://www.brevo.com/) transactional email API.
    | Create an API key in Brevo → SMTP & API → API keys.
    | Sender email must be verified in Brevo (Domains or single sender).
    */
    'brevo' => [
        'api_key' => env('BREVO_API_KEY'),
        'endpoint' => env('BREVO_API_ENDPOINT', 'https://api.brevo.com/v3'),
        'sender_email' => env('BREVO_SENDER_EMAIL'),
        'sender_name' => env('BREVO_SENDER_NAME'),
        'timeout' => (int) env('BREVO_TIMEOUT', 30),
        // Verify HTTPS to api.brevo.com (Windows dev: set false if cURL error 60 until php.ini curl.cainfo is set).
        'verify_ssl' => filter_var(env('BREVO_HTTP_VERIFY_SSL', true), FILTER_VALIDATE_BOOL),
    ],

    /*
    | AWS credentials for Rekognition (liveness / face compare).
    | Uses same env vars as Laravel docs: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION.
    */
    'aws' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'ap-southeast-1'),
    ],

    /*
    | Node chat-server → Laravel warehouse sync header `X-Support-Sync-Secret`.
    | Set sync_secret to match chat-server `LARAVEL_CHAT_SYNC_SECRET`.
    */
    'support_chat' => [
        'sync_secret' => env('SUPPORT_CHAT_SYNC_SECRET'),
    ],

    /*
    | Laravel → Node Socket.IO relay (instant visitor widgets). Full URL INCLUDING path.
    | Example (dev): NODE_CHAT_BROADCAST_URL=http://127.0.0.1:8010/api/internal/chat-broadcast/message
    | Must match chat-server CHAT_INTERNAL_BROADCAST_SECRET (header X-Chat-Broadcast-Secret).
    */
    'node_chat' => [
        'broadcast_url' => env('NODE_CHAT_BROADCAST_URL'),
        'broadcast_secret' => env('NODE_CHAT_BROADCAST_SECRET'),
    ],

    /*
    | Borrower portal email verification (signed URL → api.borrower.email.verify).
    | Cooldown avoids rapid resend bursts; queue job skips while cache key is set.
    */
    'borrower_verify' => [
        'expires_hours' => max(1, min(720, (int) env('BORROWER_VERIFY_EXPIRES_HOURS', 168))),
        'resend_cooldown_seconds' => max(30, min(3600, (int) env('BORROWER_VERIFY_RESEND_COOLDOWN', 120))),
        'send_on_register' => filter_var(env('BORROWER_VERIFY_SEND_ON_REGISTER', true), FILTER_VALIDATE_BOOL),
        // Public API origin used in borrower verification emails (falls back to APP_URL).
        'base_url' => env('BORROWER_VERIFY_URL_BASE', env('APP_URL')),
        // Frontend login path where users land after verify/failure.
        'login_path' => env('BORROWER_VERIFY_LOGIN_PATH', '/borrower/login'),
        // Optional absolute logo URL used by email templates.
        'logo_url' => env('MAIL_LOGO_URL'),
    ],

];
