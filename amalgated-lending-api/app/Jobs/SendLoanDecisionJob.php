<?php

namespace App\Jobs;

use App\Mail\LoanDecisionMail;
use App\Models\Loan;
use App\Services\BrevoMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendLoanDecisionJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public int $loanId)
    {
        $this->onQueue('notifications');
    }

    public function handle(BrevoMailService $brevo): void
    {
        $loan = Loan::with('borrower')->find($this->loanId);
        if (! $loan) {
            return;
        }

        if (! in_array((string) $loan->status, [Loan::STATUS_ONGOING, Loan::STATUS_REJECTED], true)) {
            return;
        }

        $borrower = $loan->borrower;
        if (! $borrower) {
            return;
        }

        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $decision = $loan->status === Loan::STATUS_REJECTED ? Loan::STATUS_REJECTED : Loan::STATUS_APPROVED;
        $mailable = new LoanDecisionMail($loan, (string) $borrower->name, $decision);
        $subject = $decision === Loan::STATUS_REJECTED
            ? 'Loan application update: rejected — Amalgated Lending'
            : 'Loan application update: approved — Amalgated Lending';

        if ($brevo->isConfigured()) {
            try {
                $brevo->sendHtml($email, (string) $borrower->name, $subject, $mailable->render());

                return;
            } catch (\Throwable) {
                // Fall through to default mail transport.
            }
        }

        Mail::to($email)->queue($mailable);
    }
}
