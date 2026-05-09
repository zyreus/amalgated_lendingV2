<?php

namespace App\Mail;

use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PaymentReceiptMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public Payment $payment,
    ) {
        $this->payment->loadMissing(['loan.borrower']);
    }

    public function build(): static
    {
        $borrower = $this->payment->loan?->borrower;
        $borrowerName = $borrower?->name ?? 'Borrower';
        $loan = $this->payment->loan;
        $loanNumber = $loan?->loan_number ?? ('LN-'.str_pad((string) ($this->payment->loan_id ?? 0), 6, '0', STR_PAD_LEFT));

        $officialOr = trim((string) ($this->payment->official_receipt_number ?? ''));
        if ($officialOr === '') {
            $officialOr = 'Assigned on posting';
        }

        $invoiceNumber = 'INV-'.str_pad((string) $this->payment->id, 6, '0', STR_PAD_LEFT);
        $logoUrl = rtrim((string) config('app.url'), '/').'/amalgated-lending-logo.svg';

        $remainingBalance = Payment::query()
            ->where('loan_id', $this->payment->loan_id)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS due_left')
            ->value('due_left');

        $path = $this->payment->receipt_path;
        $disk = Storage::disk('public');
        $attachmentNote = ($path && $disk->exists($path))
            ? 'A copy of your uploaded receipt image/PDF is attached when available.'
            : 'Your payment confirmation PDF can be regenerated from borrower portal records.';

        $this->subject('Payment confirmed — '.$invoiceNumber.' ('.$loanNumber.') — '.config('app.name'))
            ->view('mail.payment-receipt', [
                'borrowerName' => $borrowerName,
                'invoiceNumber' => $invoiceNumber,
                'loanNumber' => $loanNumber,
                'installmentNo' => $this->payment->installment_no ?? '—',
                'amountPaid' => number_format((float) $this->payment->amount_paid, 2),
                'paidAt' => $this->payment->paid_at?->format('F j, Y g:i A') ?? now()->format('F j, Y g:i A'),
                'remainingBalance' => number_format((float) $remainingBalance, 2),
                'officialOr' => $officialOr,
                'breakdownPrincipal' => number_format((float) ($this->payment->principal_portion ?? 0), 2),
                'breakdownInterest' => number_format((float) ($this->payment->interest_portion ?? 0), 2),
                'attachmentNote' => $attachmentNote,
                'logoUrl' => $logoUrl,
            ]);

        if ($path && $disk->exists($path)) {
            $this->attachFromStorageDisk(
                'public',
                $path,
                $this->payment->receipt_name ?: basename($path)
            );
        }

        return $this;
    }
}
