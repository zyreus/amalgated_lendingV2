<?php

namespace App\Mail;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PaymentReceiptMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Payment $payment,
    ) {
        $this->payment->loadMissing(['loan.borrower']);
    }

    public function build()
    {
        $borrower = $this->payment->loan?->borrower;
        $borrowerName = $borrower?->name ?? 'Borrower';
        $invoiceNumber = 'INV-'.str_pad((string) $this->payment->id, 6, '0', STR_PAD_LEFT);
        // Keep logo external URL for compatibility with API-rendered and SMTP transports.
        // (Mailable::embed() is not available directly on this class.)
        $logoCid = null;
        $logoUrl = rtrim((string) config('app.url'), '/').'/amalgated-lending-logo.png';

        $this->subject("Payment confirmed — {$invoiceNumber} — Amalgated Lending")
            ->view('mail.payment-receipt', [
                'borrowerName' => $borrowerName,
                'invoiceNumber' => $invoiceNumber,
                'payment' => $this->payment,
                'loanId' => $this->payment->loan_id,
                'installmentNo' => $this->payment->installment_no,
                'amountPaid' => number_format((float) $this->payment->amount_paid, 2),
                'paidAt' => $this->payment->paid_at?->format('F j, Y g:i A') ?? now()->format('F j, Y g:i A'),
                'referenceNumber' => $this->payment->reference_number ?? '—',
                'logoCid' => $logoCid,
                'logoUrl' => $logoUrl,
            ]);

        $path = $this->payment->receipt_path;
        if ($path && Storage::disk('public')->exists($path)) {
            $this->attachFromStorageDisk(
                'public',
                $path,
                $this->payment->receipt_name ?: basename($path)
            );
        }

        return $this;
    }
}
