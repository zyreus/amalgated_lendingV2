<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\PendingRequest;

class SmsOtpService
{
    /**
     * @return array{ok: bool, detail?: string}
     */
    public function sendBorrowerOtp(User $user, string $code, int $expiresMinutes): array
    {
        if (! (bool) config('services.sms.otp_enabled', false)) {
            return ['ok' => false, 'detail' => 'sms_disabled'];
        }

        $phone = $this->normalizeRecipient((string) $user->phone);
        if ($phone === '') {
            return ['ok' => false, 'detail' => 'missing_phone'];
        }

        $message = sprintf(
            'Your Amalgated Lending verification code is %s. It expires in %d minutes. Do not share this code.',
            $code,
            $expiresMinutes
        );

        return match ((string) config('services.sms.provider', 'log')) {
            'semaphore' => $this->sendViaSemaphore($phone, $message),
            'twilio' => $this->sendViaTwilio($phone, $message),
            'log' => $this->sendViaLog($phone, $message),
            default => ['ok' => false, 'detail' => 'unsupported_sms_provider'],
        };
    }

    private function normalizeRecipient(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (str_starts_with($digits, '09') && strlen($digits) === 11) {
            return '63'.substr($digits, 1);
        }
        if (str_starts_with($digits, '9') && strlen($digits) === 10) {
            return '63'.$digits;
        }
        if (str_starts_with($digits, '63') && strlen($digits) === 12) {
            return $digits;
        }

        return '';
    }

    /**
     * @return array{ok: bool, detail?: string}
     */
    private function sendViaSemaphore(string $phone, string $message): array
    {
        $apiKey = trim((string) config('services.sms.semaphore.key'));
        if ($apiKey === '') {
            return ['ok' => false, 'detail' => 'semaphore_not_configured'];
        }

        $sender = $this->semaphoreSenderName();

        try {
            $response = $this->http()
                ->post((string) config('services.sms.semaphore.url'), array_filter([
                    'apikey' => $apiKey,
                    'number' => $phone,
                    'message' => $message,
                    'sendername' => $sender,
                ], fn ($value) => $value !== null && $value !== ''));

            if ($response->successful()) {
                return ['ok' => true, 'detail' => 'semaphore_sent'];
            }

            Log::warning('sms.otp.semaphore_failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            if ($response->status() === 403 && str_contains(strtolower($response->body()), 'not yet been approved')) {
                return ['ok' => false, 'detail' => 'semaphore_account_not_approved_or_no_credits'];
            }

            return ['ok' => false, 'detail' => 'semaphore_http_'.$response->status()];
        } catch (\Throwable $e) {
            report($e);

            return [
                'ok' => false,
                'detail' => str_contains($e->getMessage(), 'cURL error 60')
                    ? 'semaphore_ssl_certificate_error'
                    : 'semaphore_exception',
            ];
        }
    }

    private function semaphoreSenderName(): ?string
    {
        $sender = trim((string) config('services.sms.semaphore.sender'));
        if ($sender === '') {
            return null;
        }

        if (! preg_match('/^[A-Za-z0-9]{1,11}$/', $sender)) {
            Log::warning('sms.otp.invalid_semaphore_sender', [
                'sender_length' => strlen($sender),
            ]);

            return null;
        }

        return $sender;
    }

    /**
     * @return array{ok: bool, detail?: string}
     */
    private function sendViaTwilio(string $phone, string $message): array
    {
        $sid = trim((string) config('services.sms.twilio.sid'));
        $token = trim((string) config('services.sms.twilio.token'));
        $from = trim((string) config('services.sms.twilio.from'));
        if ($sid === '' || $token === '' || $from === '') {
            return ['ok' => false, 'detail' => 'twilio_not_configured'];
        }

        try {
            $response = $this->http()
                ->withBasicAuth($sid, $token)
                ->post("https://api.twilio.com/2010-04-01/Accounts/{$sid}/Messages.json", [
                    'To' => '+'.$phone,
                    'From' => $from,
                    'Body' => $message,
                ]);

            if ($response->successful()) {
                return ['ok' => true, 'detail' => 'twilio_sent'];
            }

            Log::warning('sms.otp.twilio_failed', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return ['ok' => false, 'detail' => 'twilio_http_'.$response->status()];
        } catch (\Throwable $e) {
            report($e);

            return ['ok' => false, 'detail' => 'twilio_exception'];
        }
    }

    /**
     * @return array{ok: bool, detail?: string}
     */
    private function sendViaLog(string $phone, string $message): array
    {
        Log::info('sms.otp.log', [
            'phone' => $phone,
            'message' => $message,
        ]);

        return ['ok' => true, 'detail' => 'log_sent'];
    }

    private function http(): PendingRequest
    {
        $request = Http::asForm()
            ->timeout((int) config('services.sms.timeout', 10));

        if (! (bool) config('services.sms.verify_ssl', true)) {
            $request = $request->withoutVerifying();
        }

        return $request;
    }
}
