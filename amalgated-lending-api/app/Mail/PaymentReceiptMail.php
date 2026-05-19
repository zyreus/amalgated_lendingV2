<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use App\Models\Payment;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PaymentReceiptMail extends Mailable
{
    use EmbedsMailLogo;
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
            $officialOr = 'Pending';
        }

        $acknowledgementAr = trim((string) ($this->payment->acknowledgement_receipt_number ?? ''));
        if ($acknowledgementAr === '') {
            $acknowledgementAr = '—';
        }

        $invoiceNumber = 'INV-'.str_pad((string) $this->payment->id, 6, '0', STR_PAD_LEFT);

        $remainingBalance = Payment::query()
            ->where('loan_id', $this->payment->loan_id)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS due_left')
            ->value('due_left');

        $paymentMethodLabel = match (strtolower(trim((string) ($this->payment->payment_method ?? '')))) {
            'gcash' => 'GCash',
            'bank' => 'Bank transfer / deposit',
            'cash' => 'Cash',
            default => trim((string) ($this->payment->payment_method ?? '')) !== ''
                ? (string) $this->payment->payment_method
                : '—',
        };

        $disk = Storage::disk('public');
        $borrowerProofPath = $this->payment->receipt_path;
        $officialPdfPath = $this->payment->invoice_pdf_path;

        $attachmentNote = 'Your official PDF receipt is attached when available. You can also download it anytime from Borrower Portal → Payments.';

        $portalBase = rtrim((string) config('app.frontend_url', (string) config('app.url')), '/');

        $this->subject('Payment confirmed — '.$invoiceNumber.' ('.$loanNumber.') — '.config('app.name'))
            ->view('mail.payment-receipt', $this->mailViewData([
                'borrowerName' => $borrowerName,
                'invoiceNumber' => $invoiceNumber,
                'loanNumber' => $loanNumber,
                'installmentNo' => $this->payment->installment_no ?? '—',
                'amountPaid' => number_format((float) $this->payment->amount_paid, 2),
                'paidAt' => $this->payment->paid_at?->format('F j, Y g:i A') ?? now()->format('F j, Y g:i A'),
                'remainingBalance' => number_format((float) $remainingBalance, 2),
                'officialOr' => $officialOr,
                'acknowledgementAr' => $acknowledgementAr,
                'breakdownPrincipal' => number_format((float) ($this->payment->principal_portion ?? 0), 2),
                'breakdownInterest' => number_format((float) ($this->payment->interest_portion ?? 0), 2),
                'attachmentNote' => $attachmentNote,
                'paymentMethodLabel' => $paymentMethodLabel,
                'referenceNumber' => trim((string) ($this->payment->reference_number ?? '')),
                'portalPaymentsUrl' => $portalBase.'/borrower/payments',
            ]));

        if ($borrowerProofPath && $disk->exists($borrowerProofPath)) {
            $this->attachFromStorageDisk(
                'public',
                $borrowerProofPath,
                $this->payment->receipt_name ?: basename($borrowerProofPath)
            );
        }

        if ($officialPdfPath && $disk->exists($officialPdfPath)) {
            $this->attachFromStorageDisk(
                'public',
                $officialPdfPath,
                'Official-Receipt-'.$officialOr.'.pdf'
            );
        }

        return $this;
    }
}
