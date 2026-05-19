<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use App\Models\Loan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LoanApplicationReceivedMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Loan $loan,
        public string $borrowerName,
    ) {}

    public function build(): static
    {
        $payload = is_array($this->loan->application_payload) ? $this->loan->application_payload : [];
        $slug = trim((string) ($payload['loan_product_slug'] ?? ''));
        $productLabel = $slug !== ''
            ? ucwords(str_replace('-', ' ', strtolower($slug)))
            : 'Lending application';
        $branch = trim((string) ($payload['branch'] ?? $payload['preferred_branch'] ?? $payload['servicing_branch'] ?? ''));
        $branchNote = $branch !== '' ? $branch : 'Head office / nearest branch (see portal)';

        $loanRef = 'AL-'.str_pad((string) $this->loan->id, 7, '0', STR_PAD_LEFT);

        return $this->subject('Application received — '.$loanRef.' — '.config('app.name', 'Amalgated Lending Inc.'))
            ->view('mail.loan-application-received', $this->mailViewData([
                'borrowerName' => $this->borrowerName,
                'loanId' => $this->loan->id,
                'loanRef' => $loanRef,
                'productLabel' => $productLabel,
                'branchNote' => $branchNote,
                'principal' => number_format((float) $this->loan->principal, 2),
                'termMonths' => (int) $this->loan->term_months,
            ]));
    }
}
