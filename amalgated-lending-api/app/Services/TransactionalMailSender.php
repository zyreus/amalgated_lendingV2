<?php

namespace App\Services;

use App\Jobs\SendTransactionalEmailJob;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * Central Google Workspace SMTP delivery with retry, rate limiting, and structured logging.
 */
class TransactionalMailSender
{
    public function __construct(
        private readonly NotificationCenter $notifications,
        private readonly SmtpMailService $smtp,
    ) {}

    /**
     * @param  array<string, mixed>  $failureMeta
     * @param  array<int, array{name: string, path: string}>  $fileAttachments
     * @return array{ok: bool, detail: ?string}
     */
    public function sendHtmlMailable(
        Mailable $mailable,
        string $toEmail,
        string $toName,
        string $subject,
        array $failureMeta = [],
        array $fileAttachments = [],
    ): array {
        $trimmed = trim($toEmail);
        if ($trimmed === '' || ! filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            Log::notice('Transactional mail skipped — invalid recipient.', ['meta' => $failureMeta]);

            return ['ok' => false, 'detail' => 'invalid_recipient'];
        }

        if (! app(EmailSettingsService::class)->maySendTransactional()) {
            Log::notice('Transactional mail skipped — disabled in notification settings.', ['meta' => $failureMeta]);

            return ['ok' => false, 'detail' => 'email_disabled'];
        }

        if (! $this->smtp->isConfigured()) {
            Log::warning('Transactional mail skipped — SMTP not configured.', ['meta' => $failureMeta]);

            return ['ok' => false, 'detail' => 'smtp_not_configured'];
        }

        $rateKey = 'mail-send:'.Str::lower($trimmed);
        $perMinute = (int) config('mail_delivery.rate_limit_per_minute', 40);
        if (RateLimiter::tooManyAttempts($rateKey, $perMinute)) {
            Log::warning('Transactional mail rate limited.', ['recipient' => $trimmed, 'meta' => $failureMeta]);

            return ['ok' => false, 'detail' => 'rate_limited'];
        }
        RateLimiter::hit($rateKey, 60);

        if (config('mail_delivery.queue_transactional', false)) {
            SendTransactionalEmailJob::dispatch($trimmed, $toName, $subject, $mailable::class, serialize($mailable), $fileAttachments, $failureMeta);

            return ['ok' => true, 'detail' => 'queued'];
        }

        return $this->deliverNow($mailable, $trimmed, $toName, $subject, $failureMeta, $fileAttachments);
    }

    /**
     * @param  array<string, mixed>  $failureMeta
     * @param  array<int, array{name: string, path: string}>  $fileAttachments
     * @return array{ok: bool, detail: ?string}
     */
    public function deliverNow(
        Mailable $mailable,
        string $toEmail,
        string $toName,
        string $subject,
        array $failureMeta = [],
        array $fileAttachments = [],
    ): array {
        $attempts = max(1, (int) config('mail_delivery.retry_attempts', 3));
        $delayMs = max(100, (int) config('mail_delivery.retry_delay_ms', 750));
        $lastError = null;

        for ($attempt = 1; $attempt <= $attempts; $attempt++) {
            try {
                $sendable = clone $mailable;
                foreach ($fileAttachments as $row) {
                    $name = isset($row['name']) ? (string) $row['name'] : 'attachment.bin';
                    $path = isset($row['path']) ? (string) $row['path'] : '';
                    if ($path !== '' && is_readable($path)) {
                        $sendable->attach($path, ['as' => $name]);
                    }
                }

                Mail::to($toEmail, $toName !== '' ? $toName : null)->send($sendable);

                return ['ok' => true, 'detail' => 'google_workspace_smtp'];
            } catch (\Throwable $e) {
                $lastError = $e;
                Log::warning('SMTP transactional mail attempt failed.', [
                    'attempt' => $attempt,
                    'subject' => $subject,
                    'error' => $e->getMessage(),
                ]);
                if ($attempt < $attempts) {
                    usleep($delayMs * 1000 * $attempt);
                }
            }
        }

        $fallbackMailer = (string) config('mail_delivery.fallback_mailer', 'log');
        if ($fallbackMailer !== '' && $fallbackMailer !== (string) config('mail.default')) {
            try {
                Mail::mailer($fallbackMailer)->to($toEmail)->send(clone $mailable);

                return ['ok' => true, 'detail' => 'fallback_'.$fallbackMailer];
            } catch (\Throwable $fallbackError) {
                Log::error('Fallback mailer failed.', ['error' => $fallbackError->getMessage()]);
            }
        }

        if ($lastError) {
            $this->notifications->recordFailure('system', null, 'email', $lastError, array_merge($failureMeta, ['stage' => 'smtp']));
        }

        return ['ok' => false, 'detail' => $lastError?->getMessage() ?? 'send_failed'];
    }
}
