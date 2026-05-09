<?php

namespace App\Mail;

use App\Models\LoanApplication;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class GeneralLoanApplicationStatusMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public LoanApplication $application,
        public string $borrowerName,
        public string $status,
    ) {}

    public function build(): static
    {
        $ref = 'APP-'.str_pad((string) $this->application->id, 8, '0', STR_PAD_LEFT);
        $headline = match ($this->status) {
            LoanApplication::STATUS_APPROVED => 'Application approved · '.$ref,
            LoanApplication::STATUS_REJECTED => 'Application needs attention · '.$ref,
            default => 'Thank you · '.$ref.' submitted',
        };

        return $this->subject(
            match ($this->status) {
                LoanApplication::STATUS_APPROVED => 'Loan application update: approved — '.config('app.name'),
                LoanApplication::STATUS_REJECTED => 'Loan application update — '.config('app.name'),
                default => 'Loan application submitted — '.config('app.name'),
            }
        )->view('mail.general-loan-application-status', [
            'borrowerName' => $this->borrowerName,
            'applicationId' => $this->application->id,
            'loanType' => (string) $this->application->loan_type,
            'status' => $this->status,
            'rejectionReason' => (string) ($this->application->rejection_reason ?? ''),
            'submittedAt' => optional($this->application->submitted_at)?->format('M d, Y h:i A'),
            'headline' => $headline,
        ]);
    }
}
