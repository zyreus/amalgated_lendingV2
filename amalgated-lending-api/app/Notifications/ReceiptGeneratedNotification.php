<?php

namespace App\Notifications;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class ReceiptGeneratedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Payment $payment,
    ) {
        $this->payment->loadMissing('loan.borrower');
        $this->onQueue('notifications');
    }

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        $loanNumber = $this->payment->loan?->loan_number
            ?? ('LN-'.str_pad((string) ($this->payment->loan_id ?? 0), 6, '0', STR_PAD_LEFT));
        $or = trim((string) ($this->payment->official_receipt_number ?? ''));

        return [
            'type' => 'receipt_generated',
            'title' => 'Payment Received',
            'message' => 'Your payment for Loan '.$loanNumber.' has been successfully posted.',
            'loan_id' => $this->payment->loan_id,
            'loan_number' => $loanNumber,
            'payment_id' => $this->payment->id,
            'amount_paid' => (float) $this->payment->amount_paid,
            'official_receipt_number' => $or,
            'acknowledgement_receipt_number' => $this->payment->acknowledgement_receipt_number,
            'receipt_pdf_path' => $this->payment->receipt_pdf_path ?: $this->payment->invoice_pdf_path,
        ];
    }
}
