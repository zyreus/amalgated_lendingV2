<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use App\Models\Loan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LoanPreApprovedMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Loan $loan,
        public string $borrowerName,
        public ?string $adminMessage = null,
    ) {}

    public function build(): static
    {
        $payload = is_array($this->loan->application_payload) ? $this->loan->application_payload : [];
        $branch = trim((string) ($payload['branch'] ?? $payload['preferred_branch'] ?? $payload['servicing_branch'] ?? ''));
        $branchInstruction = $branch !== ''
            ? $branch
            : 'Your assigned servicing branch (see borrower portal)';

        $loanRef = 'AL-'.str_pad((string) $this->loan->id, 7, '0', STR_PAD_LEFT);
        $principal = number_format((float) ($this->loan->principal ?? 0), 2);
        $termMonths = $this->loan->term_months !== null ? (int) $this->loan->term_months : null;

        return $this->subject('Update: application pre-approved — '.$loanRef.' — '.config('app.name'))
            ->view('mail.loan-pre-approved', $this->mailViewData([
                'borrowerName' => $this->borrowerName,
                'loanId' => $this->loan->id,
                'loanRef' => $loanRef,
                'principal' => $principal,
                'termMonths' => $termMonths,
                'branchInstruction' => $branchInstruction,
                'preApprovedAt' => optional($this->loan->approved_at)?->format('M d, Y h:i A'),
                'adminMessage' => $this->adminMessage,
                'portalUrl' => rtrim((string) config('app.frontend_url', config('app.url', '')), '/').'/borrower/applications',
            ]));
    }
}
