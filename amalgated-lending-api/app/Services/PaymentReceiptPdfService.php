<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\PaymentReceipt;
use App\Support\PaymentReceiptVerificationQr;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;

class PaymentReceiptPdfService
{
    public const TEMPLATE_VERSION = 'v12';

    public static function isCurrentTemplatePdf(?string $path): bool
    {
        $path = trim((string) $path);

        return $path !== ''
            && str_contains(basename($path), '_'.self::TEMPLATE_VERSION)
            && Storage::disk('public')->exists($path);
    }

    public function __construct()
    {
        File::ensureDirectoryExists(storage_path('app/public/receipts'));
    }

    /**
     * Generate (or reuse) the official PDF receipt for a paid installment.
     *
     * @return string|null Public disk path relative to storage/app/public
     */
    public function ensureOfficialPdf(Payment $payment, ?int $generatedByUserId = null): ?string
    {
        $payment->loadMissing(['loan.borrower', 'processedByUser', 'recordedByUser', 'confirmedByUser']);

        if ($payment->status !== Payment::STATUS_PAID) {
            return null;
        }

        $path = trim((string) ($payment->receipt_pdf_path ?? $payment->invoice_pdf_path ?? ''));
        if ($path !== '' && str_contains(basename($path), '_'.self::TEMPLATE_VERSION) && Storage::disk('public')->exists($path)) {
            return $path;
        }

        $or = trim((string) ($payment->official_receipt_number ?? ''));
        if ($or === '') {
            return null;
        }

        $html = View::make('pdf.official-payment-receipt', $this->composeData($payment))->render();

        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [public_path(), storage_path('app/public')]);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();
        $binary = $dompdf->output();

        $safe = preg_replace('/[^A-Za-z0-9._-]+/', '_', $or) ?: 'OR';
        $filename = 'receipts/'.$safe.'_'.self::TEMPLATE_VERSION.'.pdf';
        if (Storage::disk('public')->exists($filename)) {
            $filename = 'receipts/'.$safe.'_p'.$payment->id.'_'.self::TEMPLATE_VERSION.'_'.Str::lower(Str::random(6)).'.pdf';
        }
        Storage::disk('public')->put($filename, $binary);

        PaymentReceipt::query()->create([
            'payment_id' => $payment->id,
            'loan_id' => $payment->loan_id,
            'receipt_number' => $or,
            'pdf_path' => $filename,
            'generated_by' => $generatedByUserId,
        ]);

        $payment->invoice_pdf_path = $filename;
        $payment->receipt_pdf_path = $filename;
        $payment->save();

        return $filename;
    }

    /**
     * @return array<string, mixed>
     */
    private function composeData(Payment $payment): array
    {
        $loan = $payment->loan;
        $borrower = $loan?->borrower;
        $loanNumber = $loan?->loan_number ?? ('LN-'.str_pad((string) ($payment->loan_id ?? 0), 6, '0', STR_PAD_LEFT));

        $remaining = (float) (Payment::query()
            ->where('loan_id', $payment->loan_id)
            ->selectRaw('COALESCE(SUM(GREATEST(amount_due - amount_paid, 0)), 0) AS r')
            ->value('r') ?? 0);

        $logoDataUri = $this->logoDataUri();

        $orTrim = trim((string) ($payment->official_receipt_number ?? ''));
        $arTrim = trim((string) ($payment->acknowledgement_receipt_number ?? ''));
        $verifyPayload = 'AMALGATED|PID:'.$payment->id.'|OR:'.($orTrim !== '' ? $orTrim : '—').'|AR:'.($arTrim !== '' ? $arTrim : '—');
        $status = strtolower((string) ($payment->status ?? Payment::STATUS_PAID));
        $role = trim((string) ($payment->encoder_role ?? ''));
        $processedByName = $this->processorDisplayName($payment);

        return [
            'payment' => $payment,
            'loan' => $loan,
            'borrower' => $borrower,
            'borrowerName' => $borrower?->name ?? 'Borrower',
            'loanNumber' => $loanNumber,
            'officialOr' => $orTrim,
            'acknowledgementAr' => $arTrim,
            'receiptQrDataUri' => PaymentReceiptVerificationQr::dataUri($verifyPayload),
            'invoiceNumber' => 'INV-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT),
            'statusLabel' => strtoupper(str_replace('_', ' ', $status !== '' ? $status : Payment::STATUS_PAID)),
            'statusClass' => match ($status) {
                Payment::STATUS_PARTIAL => 'partial',
                Payment::STATUS_OVERDUE => 'overdue',
                default => 'paid',
            },
            'amountPaid' => number_format((float) $payment->amount_paid, 2),
            'amountDue' => number_format((float) $payment->amount_due, 2),
            'paidAt' => $payment->paid_at?->format('F j, Y g:i A') ?? now()->format('F j, Y g:i A'),
            'confirmationDate' => $payment->confirmation_date?->format('F j, Y g:i A') ?? $payment->paid_at?->format('F j, Y g:i A'),
            'remainingBalance' => number_format($remaining, 2),
            'paymentMethod' => $this->formatPaymentMethod((string) ($payment->payment_method ?? '')),
            'referenceNumber' => trim((string) ($payment->reference_number ?? '')),
            'processedByName' => $processedByName,
            'processedByRole' => $role !== '' ? $role : $payment->receipt_issued_role,
            'principalPortion' => number_format((float) ($payment->principal_portion ?? 0), 2),
            'interestPortion' => number_format((float) ($payment->interest_portion ?? 0), 2),
            'installmentNo' => (string) ($payment->installment_no ?? '—'),
            'companyName' => config('app.name', 'Amalgated Lending Inc.'),
            'logoDataUri' => $logoDataUri,
            'generatedAt' => now()->format('Y-m-d H:i'),
        ];
    }

    private function formatPaymentMethod(string $raw): string
    {
        return match (strtolower(trim($raw))) {
            'gcash' => 'GCash',
            'bank' => 'Bank transfer / deposit',
            'cash' => 'Cash',
            default => $raw !== '' ? $raw : '—',
        };
    }

    private function processorDisplayName(Payment $payment): string
    {
        $candidates = [
            trim((string) ($payment->processed_by_name ?? '')),
            trim((string) ($payment->processedByUser?->name ?? '')),
            trim((string) ($payment->encoder_name ?? '')),
            trim((string) ($payment->recordedByUser?->name ?? '')),
            trim((string) ($payment->confirmedByUser?->name ?? '')),
        ];
        $generic = ['admin', 'administrator', 'collector', 'loan officer', 'system administrator'];

        foreach ($candidates as $candidate) {
            if ($candidate === '') {
                continue;
            }
            if (in_array(strtolower($candidate), $generic, true)) {
                continue;
            }

            return $candidate;
        }

        return 'Authorized representative';
    }

    private function logoDataUri(): ?string
    {
        $pngCandidates = [
            public_path('amalgated-lending-logo.png'),
            base_path('../frontend/src/assets/amalgated-lending-logo.png'),
        ];
        foreach ($pngCandidates as $p) {
            if (! is_readable($p)) {
                continue;
            }
            $raw = @file_get_contents($p);
            if ($raw !== false && $raw !== '') {
                return 'data:image/png;base64,'.base64_encode($raw);
            }
        }

        $svg = public_path('amalgated-lending-logo.svg');
        if (! is_readable($svg)) {
            return null;
        }
        $raw = @file_get_contents($svg);
        if ($raw === false || $raw === '') {
            return null;
        }

        return 'data:image/svg+xml;charset=utf-8,'.rawurlencode($raw);
    }
}
