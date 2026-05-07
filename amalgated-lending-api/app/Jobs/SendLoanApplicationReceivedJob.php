<?php

namespace App\Jobs;

use App\Mail\LoanApplicationReceivedMail;
use App\Models\Loan;
use App\Models\User;
use App\Services\BrevoMailService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendLoanApplicationReceivedJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public function __construct(public int $borrowerId, public int $loanId)
    {
        $this->onQueue('notifications');
    }

    public function handle(BrevoMailService $brevo): void
    {
        $borrower = User::find($this->borrowerId);
        $loan = Loan::find($this->loanId);
        if (! $borrower || ! $loan) {
            return;
        }

        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new LoanApplicationReceivedMail($loan, (string) $borrower->name);
        $subject = 'We received your loan application — Amalgated Lending';

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
