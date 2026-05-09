<?php

namespace App\Jobs;

use App\Mail\LoanApplicationReceivedMail;
use App\Models\User;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class SendLoanApplicationReceivedJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 4;

    /** @var array<int, int> */
    public array $backoff = [25, 90, 300, 900];

    public function __construct(
        public int $borrowerId,
        public int $loanId,
    ) {
        $this->onQueue('notifications');
    }

    public function handle(TransactionalMailSender $sender): void
    {
        $dedupeKey = 'email_sent:loan_app_received:'.$this->loanId;
        if (Cache::has($dedupeKey)) {
            return;
        }

        $borrower = User::query()->find($this->borrowerId);
        if (! $borrower instanceof User) {
            return;
        }

        $loan = \App\Models\Loan::query()->find($this->loanId);
        if (! $loan) {
            return;
        }

        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new LoanApplicationReceivedMail($loan, (string) $borrower->name);
        $loanRef = 'AL-'.str_pad((string) $loan->id, 7, '0', STR_PAD_LEFT);
        $subject = 'Application received — '.$loanRef.' — '.config('app.name', 'Amalgated Lending');

        $ok = $sender->sendHtmlMailable($mailable, $email, (string) $borrower->name, $subject, [
            'job' => __CLASS__,
            'loan_id' => $loan->id,
            'borrower_id' => $borrower->id,
        ])['ok'] ?? false;

        if ($ok) {
            Cache::put($dedupeKey, true, now()->addDays(7));
        }
    }
}
