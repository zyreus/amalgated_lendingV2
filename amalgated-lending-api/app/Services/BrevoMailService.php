<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Sends email via Brevo (Sendinblue) REST API — https://developers.brevo.com/reference/sendtransacemail
 */
class BrevoMailService
{
    public function isConfigured(): bool
    {
        $key = config('services.brevo.api_key');

        return is_string($key) && $key !== '';
    }

    /**
     * @throws RuntimeException on HTTP error or missing API response
     */
    /**
     * @param  array<int, array{name: string, content: string}>  $attachments  Base64-encoded file bodies per Brevo API.
     */
    public function sendHtml(
        string $toEmail,
        ?string $toName,
        string $subject,
        string $htmlContent,
        array $attachments = [],
    ): void {
        $key = config('services.brevo.api_key');
        if (! is_string($key) || $key === '') {
            throw new RuntimeException('Brevo API key is not configured (BREVO_API_KEY).');
        }

        $fromEmail = config('services.brevo.sender_email') ?: config('mail.from.address');
        $fromName = config('services.brevo.sender_name') ?: config('mail.from.name');
        if (! is_string($fromEmail) || $fromEmail === '' || ! filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Set a verified sender: MAIL_FROM_ADDRESS or BREVO_SENDER_EMAIL.');
        }

        $base = rtrim((string) config('services.brevo.endpoint', 'https://api.brevo.com/v3'), '/');
        $url = $base.'/smtp/email';

        $payload = [
            'sender' => [
                'name' => is_string($fromName) ? $fromName : 'Amalgated Lending Inc.',
                'email' => $fromEmail,
            ],
            'to' => [
                [
                    'email' => $toEmail,
                    'name' => $toName ?: $toEmail,
                ],
            ],
            'subject' => $subject,
            'htmlContent' => $htmlContent,
        ];

        if ($attachments !== []) {
            $payload['attachment'] = $attachments;
        }

        $pending = Http::timeout((int) config('services.brevo.timeout', 30))
            ->withHeaders([
                'api-key' => $key,
                'accept' => 'application/json',
                'content-type' => 'application/json',
            ]);
        if (! config('services.brevo.verify_ssl', true)) {
            $pending = $pending->withoutVerifying();
        }

        $response = $pending->post($url, $payload);

        if (! $response->successful()) {
            $body = $response->json();
            $message = 'Brevo request failed';
            if (is_array($body)) {
                $message = $body['message'] ?? (isset($body['code']) ? (string) $body['code'] : json_encode($body));
            } elseif (is_string($body) && $body !== '') {
                $message = $body;
            } else {
                $raw = $response->body();
                if ($raw !== '') {
                    $message = $raw;
                }
            }
            throw new RuntimeException($message);
        }
    }
}
