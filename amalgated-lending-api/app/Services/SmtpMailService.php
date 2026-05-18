<?php

namespace App\Services;

use App\Mail\SmtpTestMail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\Smtp\Stream\SocketStream;

/**
 * Google Workspace SMTP helpers: configuration checks, health probe, test send.
 */
class SmtpMailService
{
    public function isConfigured(): bool
    {
        $host = trim((string) config('mail.mailers.smtp.host', ''));
        $user = trim((string) config('mail.mailers.smtp.username', ''));
        $pass = (string) config('mail.mailers.smtp.password', '');

        return $host !== '' && $user !== '' && $pass !== '' && $pass !== 'null';
    }

    /**
     * @return array<string, mixed>
     */
    public function status(): array
    {
        $mailer = (string) config('mail.default', 'smtp');
        $fromAddress = (string) config('mail.from.address', '');
        $fromName = (string) config('mail.from.name', '');

        return [
            'configured' => $this->isConfigured(),
            'mailer' => $mailer,
            'provider' => 'google_workspace_smtp',
            'host' => (string) config('mail.mailers.smtp.host', ''),
            'port' => (int) config('mail.mailers.smtp.port', 587),
            'encryption' => (string) config('mail.mailers.smtp.encryption', 'tls'),
            'username' => $this->maskEmail((string) config('mail.mailers.smtp.username', '')),
            'from_address' => $fromAddress,
            'from_name' => $fromName,
            'password_set' => $this->isConfigured(),
            'queue_transactional' => (bool) config('mail_delivery.queue_transactional', false),
            'fallback_mailer' => (string) config('mail_delivery.fallback_mailer', 'log'),
        ];
    }

    /**
     * @return array{ok: bool, latency_ms: ?int, message: string}
     */
    public function healthCheck(): array
    {
        if (! $this->isConfigured()) {
            return [
                'ok' => false,
                'latency_ms' => null,
                'message' => 'SMTP is not configured. Set MAIL_HOST, MAIL_USERNAME, and MAIL_PASSWORD in .env.',
            ];
        }

        $started = microtime(true);

        try {
            $transport = $this->buildProbeTransport();
            $transport->start();
            $transport->stop();
            $latency = (int) round((microtime(true) - $started) * 1000);

            return [
                'ok' => true,
                'latency_ms' => $latency,
                'message' => 'SMTP connection successful.',
            ];
        } catch (\Throwable $e) {
            Log::warning('SMTP health check failed.', ['error' => $e->getMessage()]);

            return [
                'ok' => false,
                'latency_ms' => null,
                'message' => $e->getMessage(),
            ];
        }
    }

    public function sendTestEmail(string $toEmail): void
    {
        $key = 'smtp-test:'.strtolower(trim($toEmail));
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw new \RuntimeException('Too many test emails. Wait a minute and try again.');
        }
        RateLimiter::hit($key, 60);

        Mail::to($toEmail)->send(new SmtpTestMail);
    }

    private function buildProbeTransport(): EsmtpTransport
    {
        $host = (string) config('mail.mailers.smtp.host', 'smtp.gmail.com');
        $port = (int) config('mail.mailers.smtp.port', 587);
        $encryption = strtolower((string) config('mail.mailers.smtp.encryption', 'tls'));
        $username = (string) config('mail.mailers.smtp.username', '');
        $password = (string) config('mail.mailers.smtp.password', '');

        $transport = new EsmtpTransport($host, $port, $encryption === 'ssl');
        $transport->setUsername($username);
        $transport->setPassword($password);

        $stream = $transport->getStream();
        if ($stream instanceof SocketStream) {
            $stream->setTimeout(15);
        }

        return $transport;
    }

    private function maskEmail(string $email): string
    {
        if ($email === '' || ! str_contains($email, '@')) {
            return '';
        }
        [$local, $domain] = explode('@', $email, 2);
        $visible = strlen($local) > 2 ? substr($local, 0, 2) : substr($local, 0, 1);

        return $visible.'***@'.$domain;
    }
}
