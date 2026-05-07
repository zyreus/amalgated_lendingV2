<?php

namespace App\Jobs;

use App\Mail\PaymentReceiptMail;
use App\Models\Payment;
use App\Services\BrevoMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendPaymentReceiptJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public int $paymentId)
    {
        $this->onQueue('notifications');
    }

    public function handle(BrevoMailService $brevo): void
    {
        $payment = Payment::with('loan.borrower')->find($this->paymentId);
        if (! $payment) {
            return;
        }

        $email = trim((string) ($payment->loan?->borrower?->email ?? ''));
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $borrowerName = $payment->loan?->borrower?->name ?: $email;
        $invoiceNumber = 'INV-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT);
        $subject = "Payment confirmed — {$invoiceNumber} — Amalgated Lending";
        $mailable = new PaymentReceiptMail($payment);

        if ($brevo->isConfigured()) {
            try {
                $brevo->sendHtml($email, $borrowerName, $subject, $mailable->render());

                return;
            } catch (\Throwable $e) {
                Log::warning('Brevo receipt send failed in queue job.', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        Mail::to($email)->queue($mailable);
    }
}
