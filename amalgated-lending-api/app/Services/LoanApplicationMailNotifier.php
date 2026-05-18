<?php

namespace App\Services;

use App\Mail\LoanApplicationReceivedMail;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Log;

/**
 * Sends loan-application received emails via Google Workspace SMTP.
 */
class LoanApplicationMailNotifier
{
    public function __construct(
        private readonly TransactionalMailSender $mail,
    ) {}

    public function sendReceived(User $borrower, Loan $loan, string $subject): void
    {
        $email = trim((string) $borrower->email);
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $mailable = new LoanApplicationReceivedMail($loan, (string) $borrower->name);
        $this->sendMailable($mailable, $email, (string) $borrower->name, $subject, [
            'flow' => 'loan_application_received',
            'loan_id' => $loan->id,
        ]);
    }

    /**
     * @param  array<string, mixed>  $meta
     */
    public function sendMailable(Mailable $mailable, string $email, string $name, string $subject, array $meta = []): void
    {
        $result = $this->mail->sendHtmlMailable($mailable, $email, $name, $subject, $meta);
        if (! ($result['ok'] ?? false)) {
            Log::warning('Loan application email was not delivered.', array_merge($meta, [
                'recipient' => $email,
                'detail' => $result['detail'] ?? null,
            ]));
        }
    }
}
