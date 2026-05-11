<?php

namespace App\Services;

use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Central Brevo + Laravel mail fallback with structured logging for transactional flows.
 */
class TransactionalMailSender
{
    public function __construct(
        private readonly BrevoMailService $brevo,
        private readonly NotificationCenter $notifications,
    ) {}

    /**
     * @param  array<string, mixed>  $failureMeta  Stored when both transports fail (FailedNotification.payload).
     * @param  array<int, array{name: string, path: string}>  $brevoFileAttachments  Files read and sent as Brevo base64 attachments (not used on Laravel mail fallback).
     * @return array{ok: bool, detail: ?string}
     */
    public function sendHtmlMailable(Mailable $mailable, string $toEmail, string $toName, string $subject, array $failureMeta = [], array $brevoFileAttachments = []): array
    {
        $trimmed = trim($toEmail);
        if ($trimmed === '' || ! filter_var($trimmed, FILTER_VALIDATE_EMAIL)) {
            Log::notice('Transactional mail skipped — invalid recipient.', ['meta' => $failureMeta]);

            return ['ok' => false, 'detail' => 'invalid_recipient'];
        }

        try {
            if ($this->brevo->isConfigured()) {
                $html = $mailable->render();
                $brevoAttachments = [];
                foreach ($brevoFileAttachments as $row) {
                    $name = isset($row['name']) ? (string) $row['name'] : 'attachment.bin';
                    $path = isset($row['path']) ? (string) $row['path'] : '';
                    if ($path === '' || ! is_readable($path)) {
                        continue;
                    }
                    $raw = @file_get_contents($path);
                    if ($raw === false || $raw === '') {
                        continue;
                    }
                    $brevoAttachments[] = [
                        'name' => $name,
                        'content' => base64_encode($raw),
                    ];
                }
                $this->brevo->sendHtml($trimmed, $toName ?: $trimmed, $subject, $html, $brevoAttachments);

                return ['ok' => true, 'detail' => 'brevo'];
            }
        } catch (\Throwable $e) {
            Log::warning('Brevo transactional mail failed.', [
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
            $this->notifications->recordFailure('system', null, 'email', $e, array_merge($failureMeta, ['stage' => 'brevo']));
        }

        try {
            Mail::to($trimmed)->queue($mailable);

            return ['ok' => true, 'detail' => 'queued'];
        } catch (\Throwable $e) {
            Log::error('Default mail queue failed.', [
                'subject' => $subject,
                'error' => $e->getMessage(),
            ]);
            $this->notifications->recordFailure('system', null, 'email', $e, array_merge($failureMeta, ['stage' => 'laravel_queue']));

            return ['ok' => false, 'detail' => $e->getMessage()];
        }
    }
}
