<?php

namespace App\Jobs;

use App\Mail\LoanDecisionMail;
use App\Models\Loan;
use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class SendLoanDecisionJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    /** @var array<int, int> */
    public array $backoff = [15, 60, 180, 600, 3600];

    public function __construct(public int $loanId)
    {
        $this->onQueue('notifications');
    }

    public function handle(TransactionalMailSender $sender): void
    {
        $loan = Loan::with('borrower')->find($this->loanId);
        if (! $loan || ! $loan->borrower) {
            return;
        }

        if (! in_array((string) $loan->status, [Loan::STATUS_ONGOING, Loan::STATUS_REJECTED], true)) {
            return;
        }

        $borrower = $loan->borrower;
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $decision = $loan->status === Loan::STATUS_REJECTED ? Loan::STATUS_REJECTED : Loan::STATUS_APPROVED;
        $dedupeCacheKey = 'email_sent:last_loan_decision:'.$loan->id;
        $fingerprint = $decision.'|'.(string) (($loan->approved_at?->getTimestamp()) ?? 0);
        if (Cache::get($dedupeCacheKey) === $fingerprint) {
            return;
        }

        $mailable = new LoanDecisionMail($loan, (string) $borrower->name, $decision);

        $loanRef = 'AL-'.str_pad((string) $loan->id, 7, '0', STR_PAD_LEFT);
        $subject = $decision === Loan::STATUS_REJECTED
            ? 'Decision: not approved — '.$loanRef.' — '.config('app.name')
            : 'Decision: approved — '.$loanRef.' — '.config('app.name');

        $ok = $sender->sendHtmlMailable($mailable, $email, (string) $borrower->name, $subject, [
            'job' => __CLASS__,
            'loan_id' => $loan->id,
            'decision' => $decision,
        ])['ok'] ?? false;

        if ($ok) {
            Cache::put($dedupeCacheKey, $fingerprint, now()->addDays(45));
        }
    }
}
