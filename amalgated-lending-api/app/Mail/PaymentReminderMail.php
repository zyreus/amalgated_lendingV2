<?php

namespace App\Mail;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PaymentReminderMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Payment $payment,
        public User $borrower,
        public string $variant,
        public int $daysOffset,
        public string $loanRef,
    ) {}

    public function build(): static
    {
        $dueDate = $this->payment->due_date?->format('F j, Y') ?? '—';
        $amount = number_format((float) ($this->payment->amount_due ?? 0), 2);
        $installment = (int) ($this->payment->installment_no ?? 0);

        $headline = $this->variant === 'overdue'
            ? 'Payment overdue'
            : 'Upcoming payment reminder';

        return $this->view('mail.payment-reminder', [
            'borrowerName' => $this->borrower->name,
            'headline' => $headline,
            'variant' => $this->variant,
            'daysOffset' => $this->daysOffset,
            'dueDate' => $dueDate,
            'amount' => $amount,
            'installment' => $installment,
            'loanRef' => $this->loanRef,
            'portalUrl' => rtrim((string) config('app.frontend_url', ''), '/').'/borrower/payments',
        ]);
    }
}
