<?php

namespace App\Jobs;

use App\Mail\PaymentReceiptMail;
use App\Models\EmailLog;
use App\Models\Payment;
use App\Support\BorrowerContactEmail;
use App\Services\PaymentReceiptPdfService;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

class SendPaymentReceiptJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [20, 90, 300, 1200];

    public function __construct(
        public int $paymentId,
        public string $receiptNumber,
        public ?int $confirmedByAdminId = null,
    ) {
        $this->onQueue('notifications');
    }

    public static function dedupeKey(int $paymentId, string $receiptNumber): string
    {
        return 'payment_receipt:'.$paymentId.':'.trim($receiptNumber);
    }

    public function handle(TransactionalMailSender $sender, PaymentReceiptPdfService $pdfService): void
    {
        $dedupeKey = self::dedupeKey($this->paymentId, $this->receiptNumber);

        $payment = Payment::query()
            ->with(['loan.borrower', 'loan', 'processedByUser', 'recordedByUser', 'confirmedByUser'])
            ->find($this->paymentId);

        if (! $payment || $payment->status !== Payment::STATUS_PAID) {
            return;
        }

        if (trim((string) ($payment->official_receipt_number ?? '')) !== $this->receiptNumber) {
            return;
        }

        $borrower = $payment->loan?->borrower;
        $email = BorrowerContactEmail::forPayment($payment);
        if (! BorrowerContactEmail::isValid($email)) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $payment->loan_id,
                    'payment_id' => $payment->id,
                    'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                    'mailable_class' => PaymentReceiptMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower?->name,
                    'subject' => null,
                    'status' => EmailLog::STATUS_FAILED,
                    'transport_detail' => 'invalid_recipient',
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['job' => static::class],
                ]
            );

            return;
        }

        if (EmailLog::query()->where('dedupe_key', $dedupeKey)->where('status', EmailLog::STATUS_SENT)->exists()) {
            return;
        }

        $cacheKey = 'email_sent:payment_receipt:'.$this->paymentId;
        if (Cache::get($cacheKey) === $this->receiptNumber) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $dedupeKey],
                [
                    'loan_id' => $payment->loan_id,
                    'payment_id' => $payment->id,
                    'notification_type' => EmailLog::NOTIFICATION_PAYMENT_RECEIPT,
                    'mailable_class' => PaymentReceiptMail::class,
                    'recipient_email' => $email,
                    'recipient_name' => $borrower?->name,
                    'status' => EmailLog::STATUS_SKIPPED_DUPLICATE,
                    'transport_detail' => 'cache',
                    'meta' => ['job' => static::class],
                ]
            );

            return;
        }

        $pdfPath = null;
        try {
            $pdfPath = $pdfService->ensureOfficialPdf($payment, $this->confirmedByAdminId);
            if ($pdfPath) {
                $payment->forceFill([
                    'receipt_pdf_path' => $pdfPath,
                    'invoice_pdf_path' => $payment->invoice_pdf_path ?: $pdfPath,
                ])->save();
            }
        } catch (Throwable $e) {
            Log::warning('Payment receipt PDF skipped; sending email without attachment.', [
                'payment_id' => $payment->id,
                'error' => $e->getMessage(),
            ]);
        }
        $payment->refresh();

        $payment = $payment->fresh(['loan.borrower', 'processedByUser', 'recordedByUser', 'confirmedByUser']);
        $mailable = new PaymentReceiptMail($payment);

        $loanNumber = $payment->loan?->loan_number ?? ('LN-'.str_pad((string) ($payment->loan_id ?? 0), 6, '0', STR_PAD_LEFT));
        $subject = 'Payment confirmed — Loan '.$loanNumber.' — '.config('app.name', 'Amalgated Lending Inc.');

        try {
            $send = $sender->sendHtmlMailable($mailable, $email, (string) ($borrower?->name ?: $email), $subject, [
                'job' => __CLASS__,
                'payment_id' => $payment->id,
                'dedupe_key' => $dedupeKey,
            ]);
            $ok = $send['ok'] ?? false;
            $detail = (string) ($send['detail'] ?? '');

            if ($ok) {
                EmailLog::query()->where('dedupe_key', $dedupeKey)->update([
                    'subject' => $subject,
                    'status' => EmailLog::STATUS_SENT,
                    'transport_detail' => $detail !== '' ? $detail : null,
                    'sent_at' => now(),
                    'error_message' => null,
                ]);
                $payment->forceFill(['emailed_at' => now()])->save();
                Cache::put($cacheKey, $this->receiptNumber, now()->addDays(45));
            } else {
                EmailLog::query()->where('dedupe_key', $dedupeKey)->update([
                    'status' => EmailLog::STATUS_FAILED,
                    'error_message' => $detail !== '' ? $detail : 'send_failed',
                ]);
                throw new \RuntimeException('Transactional mail send returned failure: '.$detail);
            }
        } catch (Throwable $e) {
            EmailLog::query()->where('dedupe_key', $dedupeKey)->update([
                'status' => EmailLog::STATUS_FAILED,
                'error_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            throw $e;
        }
    }
}
