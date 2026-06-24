<?php

namespace App\Jobs;

use App\Mail\LoanApplicationUpdateMail;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Throwable;

class SendBorrowerLoanApplicationUpdateJob implements ShouldBeUnique, ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 180, 600, 3600];

    public function __construct(
        public int $loanId,
        public string $eventType,
        public string $dedupeKey,
        public ?float $requestedAmount = null,
        public ?float $approvedAmount = null,
        public ?float $previousApprovedAmount = null,
        public ?string $statusLabel = null,
        public ?string $remarks = null,
        public ?string $documentLabel = null,
        public ?int $borrowerNotificationId = null,
    ) {
        $this->onQueue('notifications');
    }

    public function uniqueId(): string
    {
        return $this->dedupeKey;
    }

    public function uniqueFor(): int
    {
        return 300;
    }

    public function handle(TransactionalMailSender $sender): void
    {
        if (EmailLog::query()->where('dedupe_key', $this->dedupeKey)->where('status', EmailLog::STATUS_SENT)->exists()) {
            return;
        }

        $loan = Loan::query()->with(['borrower:id,name,email'])->find($this->loanId);
        if (! $loan || ! $loan->borrower) {
            return;
        }

        $borrower = $loan->borrower;
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $this->dedupeKey],
                [
                    'loan_id' => $loan->id,
                    'notification_type' => EmailLog::NOTIFICATION_LOAN_APPLICATION_UPDATE,
                    'mailable_class' => LoanApplicationUpdateMail::class,
                    'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                    'recipient_name' => $borrower->name,
                    'status' => EmailLog::STATUS_FAILED,
                    'error_message' => 'Missing or invalid borrower email.',
                    'meta' => ['event_type' => $this->eventType],
                ]
            );

            return;
        }

        $cacheKey = 'email_sent:loan_app_update:'.$this->dedupeKey;
        if (Cache::get($cacheKey)) {
            return;
        }

        $mailable = new LoanApplicationUpdateMail(
            $loan,
            (string) $borrower->name,
            $this->eventType,
            $this->requestedAmount,
            $this->approvedAmount,
            $this->previousApprovedAmount,
            $this->statusLabel,
            $this->remarks,
            $this->documentLabel,
        );

        $subject = 'Loan Application Update — '.config('app.name');

        try {
            $send = $sender->sendHtmlMailable($mailable, $email, (string) $borrower->name, $subject, [
                'job' => __CLASS__,
                'loan_id' => $loan->id,
                'event_type' => $this->eventType,
                'dedupe_key' => $this->dedupeKey,
            ]);

            $ok = $send['ok'] ?? false;
            $detail = (string) ($send['detail'] ?? '');

            EmailLog::query()->updateOrCreate(
                ['dedupe_key' => $this->dedupeKey],
                [
                    'loan_id' => $loan->id,
                    'notification_type' => EmailLog::NOTIFICATION_LOAN_APPLICATION_UPDATE,
                    'mailable_class' => LoanApplicationUpdateMail::class,
                    'recipient_email' => $email,
                    'recipient_name' => $borrower->name,
                    'subject' => $subject,
                    'status' => $ok ? EmailLog::STATUS_SENT : EmailLog::STATUS_FAILED,
                    'transport_detail' => $detail !== '' ? $detail : null,
                    'sent_at' => $ok ? now() : null,
                    'error_message' => $ok ? null : ($detail !== '' ? $detail : 'send_failed'),
                    'meta' => [
                        'event_type' => $this->eventType,
                        'borrower_notification_id' => $this->borrowerNotificationId,
                    ],
                ]
            );

            if ($ok) {
                Cache::put($cacheKey, true, now()->addDays(30));
            } else {
                throw new \RuntimeException('Transactional mail send returned failure: '.$detail);
            }
        } catch (Throwable $e) {
            EmailLog::query()->where('dedupe_key', $this->dedupeKey)->update([
                'status' => EmailLog::STATUS_FAILED,
                'error_message' => mb_substr($e->getMessage(), 0, 2000),
            ]);
            throw $e;
        }
    }
}
