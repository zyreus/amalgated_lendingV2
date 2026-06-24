<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use App\Models\Loan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LoanApplicationUpdateMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Loan $loan,
        public string $borrowerName,
        public string $eventType,
        public ?float $requestedAmount = null,
        public ?float $approvedAmount = null,
        public ?float $previousApprovedAmount = null,
        public ?string $statusLabel = null,
        public ?string $remarks = null,
        public ?string $documentLabel = null,
    ) {}

    public function build(): static
    {
        $loanRef = 'AL-'.str_pad((string) $this->loan->id, 7, '0', STR_PAD_LEFT);

        return $this->subject('Loan Application Update — '.config('app.name'))
            ->view('mail.loan-application-update', $this->mailViewData([
                'borrowerName' => $this->borrowerName,
                'loanRef' => $loanRef,
                'eventType' => $this->eventType,
                'requestedAmount' => $this->requestedAmount,
                'approvedAmount' => $this->approvedAmount,
                'previousApprovedAmount' => $this->previousApprovedAmount,
                'statusLabel' => $this->statusLabel,
                'remarks' => $this->remarks,
                'documentLabel' => $this->documentLabel,
                'portalUrl' => rtrim((string) config('app.frontend_url', config('app.url')), '/').'/borrower/dashboard',
            ]));
    }
}
