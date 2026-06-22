<?php

namespace App\Jobs;

use App\Mail\LoanPreApprovedMail;
use App\Models\EmailLog;
use App\Models\Loan;
use App\Services\EmailSettingsService;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class SendLoanPreApprovedJob implements ShouldBeUnique, ShouldQueue
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
        public int $decisionTs,
    ) {
        $this->onQueue('notifications');
    }

    public function uniqueId(): string
    {
        return 'loan_pre_approved:'.$this->loanId.':'.$this->decisionTs;
    }

    public function uniqueFor(): int
    {
        return 180;
    }

    public static function dedupeKey(int $loanId, int $decisionTs): string
    {
        return 'loan_pre_approved:'.$loanId.':'.$decisionTs;
    }

    public function handle(TransactionalMailSender $sender, EmailSettingsService $emailSettings): void
    {
        $dedupeKey = self::dedupeKey($this->loanId, $this->decisionTs);

        $loan = Loan::query()
            ->with(['borrower:id,name,email'])
            ->find($this->loanId);

        if (! $loan || ! $loan->borrower) {
            return;
        }

        if ((string) $loan->status !== Loan::STATUS_PRE_APPROVED) {
            Log::notice('SendLoanPreApprovedJob skipped — loan is no longer pre-approved.', [
                'loan_id' => $this->loanId,
                'status' => $loan->status,
            ]);

            return;
        }

        $borrower = $loan->borrower;
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->logInvalidRecipient($dedupeKey, $loan, $borrower, $email);

            return;
        }

        $cacheKey = 'email_sent:last_loan_pre_approved:'.$loan->id;
        $fingerprint = 'pre-approved|'.$this->decisionTs;
        if (Cache::get($cacheKey) === $fingerprint) {
            $this->logCacheDuplicate($dedupeKey, $loan, $borrower, $email);

            return;
        }

        if (EmailLog::query()->where('dedupe_key', $dedupeKey)->where('status', EmailLog::STATUS_SENT)->exists()) {
            return;
        }

        $adminMessage = trim((string) ($loan->admin_notes ?? ''));
        $adminMessage = $adminMessage !== '' ? $adminMessage : null;

        $mailable = new LoanPreApprovedMail($loan, (string) $borrower->name, $adminMessage);

        $loanRef = 'AL-'.str_pad((string) $loan->id, 7, '0', STR_PAD_LEFT);
        $subject = $emailSettings->templateSubject(
            'loan_pre_approved',
            'Update: application pre-approved — '.$loanRef,
        );
        $subject .= ' — '.config('app.name');

        try {
            $send = $sender->sendHtmlMailable($mailable, $email, (string) $borrower->name, $subject, [
                'job' => __CLASS__,
                'loan_id' => $loan->id,
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
                Cache::put($cacheKey, $fingerprint, now()->addDays(45));
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

    private function logInvalidRecipient(string $dedupeKey, Loan $loan, $borrower, string $email): void
    {
        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loan->id,
                'notification_type' => EmailLog::NOTIFICATION_LOAN_PRE_APPROVED,
                'mailable_class' => LoanPreApprovedMail::class,
                'recipient_email' => $email !== '' ? $email : 'invalid@invalid.local',
                'recipient_name' => $borrower ? (string) $borrower->name : null,
                'subject' => null,
                'status' => EmailLog::STATUS_FAILED,
                'transport_detail' => 'invalid_recipient',
                'error_message' => 'Missing or invalid borrower email.',
                'meta' => ['job' => static::class],
            ]
        );
    }

    private function logCacheDuplicate(string $dedupeKey, Loan $loan, $borrower, string $email): void
    {
        EmailLog::query()->updateOrCreate(
            ['dedupe_key' => $dedupeKey],
            [
                'loan_id' => $loan->id,
                'notification_type' => EmailLog::NOTIFICATION_LOAN_PRE_APPROVED,
                'mailable_class' => LoanPreApprovedMail::class,
                'recipient_email' => $email,
                'recipient_name' => (string) $borrower->name,
                'subject' => null,
                'status' => EmailLog::STATUS_SKIPPED_DUPLICATE,
                'transport_detail' => 'cache_fingerprint',
                'error_message' => null,
                'meta' => ['job' => static::class, 'reason' => 'cache_duplicate'],
            ]
        );
    }
}
