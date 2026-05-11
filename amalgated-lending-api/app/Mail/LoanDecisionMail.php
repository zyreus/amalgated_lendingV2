<?php

namespace App\Mail;

use App\Models\Loan;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class LoanDecisionMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Loan $loan,
        public string $borrowerName,
        public string $decision,
        public ?string $adminMessage = null,
    ) {}

    public function build(): static
    {
        $isRejected = $this->decision === Loan::STATUS_REJECTED;
        $payload = is_array($this->loan->application_payload) ? $this->loan->application_payload : [];
        $branch = trim((string) ($payload['branch'] ?? $payload['preferred_branch'] ?? $payload['servicing_branch'] ?? ''));
        $branchInstruction = $branch !== ''
            ? $branch
            : 'Your assigned servicing branch (see borrower portal)';
        $schedule = is_array($this->loan->schedule_json) ? $this->loan->schedule_json : [];
        $previewRows = [];
        foreach (array_slice($schedule, 0, 4) as $row) {
            if (! is_array($row)) {
                continue;
            }
            $previewRows[] = [
                'no' => (string) ($row['installment_no'] ?? ''),
                'due' => isset($row['due_date']) ? (string) $row['due_date'] : '',
                'amt' => number_format((float) ($row['payment'] ?? $row['amortization'] ?? 0), 2),
            ];
        }

        $loanRef = 'AL-'.str_pad((string) $this->loan->id, 7, '0', STR_PAD_LEFT);
        $subject = $isRejected
            ? 'Decision: not approved — '.$loanRef.' — '.config('app.name')
            : 'Decision: approved — '.$loanRef.' — '.config('app.name');

        $estimatedCount = ($this->loan->term_months !== null) ? (string) ((int) $this->loan->term_months) : 'Per schedule';

        $nextPaymentDue = '';
        $nextPaymentAmount = '';
        if ($previewRows !== []) {
            $nextPaymentDue = (string) ($previewRows[0]['due'] ?? '');
            $nextPaymentAmount = (string) ($previewRows[0]['amt'] ?? '');
        }

        return $this->subject($subject)
            ->view('mail.loan-decision', [
                'borrowerName' => $this->borrowerName,
                'loanId' => $this->loan->id,
                'loanRef' => $loanRef,
                'isRejected' => $isRejected,
                'principal' => number_format((float) $this->loan->principal, 2),
                'termMonths' => (int) $this->loan->term_months,
                'rejectionReason' => (string) ($this->loan->rejection_reason ?? ''),
                'approvedAt' => optional($this->loan->approved_at)?->format('M d, Y h:i A'),
                'monthlyPayment' => number_format((float) ($this->loan->monthly_payment ?? 0), 2),
                'estimatedTotalPayments' => $estimatedCount,
                'branchInstruction' => $branchInstruction,
                'schedulePreview' => $previewRows,
                'adminMessage' => $this->adminMessage,
                'nextPaymentDue' => $nextPaymentDue,
                'nextPaymentAmount' => $nextPaymentAmount,
            ]);
    }
}
