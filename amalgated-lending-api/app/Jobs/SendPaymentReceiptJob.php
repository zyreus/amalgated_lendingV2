<?php

namespace App\Jobs;

use App\Mail\PaymentReceiptMail;
use App\Models\Payment;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class SendPaymentReceiptJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [20, 90, 300, 1200];

    public function __construct(public int $paymentId)
    {
        $this->onQueue('notifications');
    }

    public function handle(TransactionalMailSender $sender): void
    {
        if (Cache::has('email_sent:payment_receipt:'.$this->paymentId)) {
            return;
        }

        $payment = Payment::with('loan.borrower')->find($this->paymentId);
        if (! $payment) {
            return;
        }

        $email = trim((string) ($payment->loan?->borrower?->email ?? ''));
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $borrowerName = $payment->loan?->borrower?->name ?: $email;
        $mailable = new PaymentReceiptMail($payment);

        $path = $payment->receipt_path;
        $hasAttachment = $path && Storage::disk('public')->exists($path);

        if ($hasAttachment) {
            try {
                Mail::to($email)->queue($mailable);
                Cache::put('email_sent:payment_receipt:'.$this->paymentId, true, now()->addDays(14));

                return;
            } catch (\Throwable $e) {
                Log::warning('Receipt mail queue with attachment failed; falling back to HTML-only.', [
                    'payment_id' => $payment->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $invoiceNumber = 'INV-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT);
        $subject = 'Payment confirmed — '.$invoiceNumber.' — '.config('app.name', 'Amalgated Lending');
        $ok = $sender->sendHtmlMailable($mailable, $email, (string) $borrowerName, $subject, [
            'job' => __CLASS__,
            'payment_id' => $payment->id,
        ])['ok'] ?? false;

        if ($ok) {
            Cache::put('email_sent:payment_receipt:'.$this->paymentId, true, now()->addDays(14));
        }
    }
}
