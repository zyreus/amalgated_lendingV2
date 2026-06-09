<?php

namespace App\Http\Resources;

use App\Services\PaymentReceiptStatusManager;
use App\Support\PublicStorageUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $borrower = $this->loan?->borrower;
        $term = (int) ($this->loan?->term_months ?? 0);
        $isFinal = (bool) ($this->is_final_payment ?? false) || ($term > 0 && (int) $this->installment_no === $term);

        $invoicePath = $this->receipt_pdf_path ?: ($this->invoice_pdf_path ?? null);
        $statusLower = strtolower((string) $this->status);
        $processedByName = $this->processed_by_name
            ?: $this->encoder_name
            ?: $this->processedByUser?->name
            ?: $this->encodedByUser?->name
            ?: $this->recordedByUser?->name
            ?: $this->confirmedByUser?->name;

        return [
            'id' => $this->id,
            'loan_id' => $this->loan_id,
            'borrower_id' => $this->loan?->borrower_id,
            'installment_no' => $this->installment_no,
            'official_receipt_number' => $this->official_receipt_number,
            'acknowledgement_receipt_number' => $this->acknowledgement_receipt_number,
            'or_number' => $this->official_receipt_number,
            'ar_number' => $this->acknowledgement_receipt_number,
            'receipt_status' => $this->receipt_status,
            'receipt_document_coverage' => app(PaymentReceiptStatusManager::class)->documentCoverageLabel($this->resource),
            'receipt_issued_at' => optional($this->receipt_issued_at)?->toIso8601String(),
            'receipt_issued_by_name' => $this->receiptIssuedByUser?->name,
            'receipt_issued_role' => $this->receipt_issued_role,
            'verified_at' => optional($this->verified_at)?->toIso8601String(),
            'verified_by_name' => $this->verifiedByUser?->name,
            'approved_at' => optional($this->approved_at)?->toIso8601String(),
            'approved_by_name' => $this->approvedByUser?->name,
            'recorded_by_name' => $this->recordedByUser?->name,
            'encoded_by' => $this->encoded_by,
            'encoder_name' => $this->encoder_name ?: $this->encodedByUser?->name ?: $this->recordedByUser?->name,
            'encoder_role' => $this->encoder_role,
            'processed_by_user_id' => $this->processed_by_user_id,
            'processed_by_name' => $processedByName,
            'processed_by_role' => $this->encoder_role ?: $this->receipt_issued_role,
            'is_receipt_locked' => $statusLower === 'paid',
            'invoice_pdf_path' => $invoicePath,
            'invoice_pdf_url' => $invoicePath ? PublicStorageUrl::apiUrl((string) $invoicePath) : null,
            'receipt_pdf_path' => $invoicePath,
            'emailed_at' => optional($this->emailed_at)?->toIso8601String(),
            'notification_sent_at' => optional($this->notification_sent_at)?->toIso8601String(),
            'confirmation_date' => optional($this->confirmation_date)?->toIso8601String(),
            'confirmed_by_name' => $this->confirmedByUser?->name,
            'receipt_email_status' => $this->resource->getAttribute('_receipt_email_status'),
            'loan_term_months' => $term > 0 ? $term : null,
            'is_final_payment' => $isFinal,
            'original_amount_due' => $this->original_amount_due !== null ? (float) $this->original_amount_due : null,
            'adjustment_reason' => $this->adjustment_reason,
            'adjusted_at' => optional($this->adjusted_at)?->toIso8601String(),
            'loan_outstanding_balance' => $this->loan?->outstanding_balance !== null ? (float) $this->loan->outstanding_balance : null,
            'due_date' => optional($this->due_date)?->toDateString(),
            'amount_due' => (float) $this->amount_due,
            'amount_paid' => (float) $this->amount_paid,
            'penalty_amount' => (float) ($this->penalty_amount ?? 0),
            'status' => $this->status,
            'paid_at' => optional($this->paid_at)?->toIso8601String(),
            'source' => $this->source,
            'reference_number' => $this->reference_number,
            'payment_method' => $this->payment_method,
            'payment_type' => $this->payment_type,
            'receipt_path' => $this->receipt_path,
            'receipt_url' => $this->receipt_path ? PublicStorageUrl::apiUrl($this->receipt_path) : null,
            'receipt_name' => $this->receipt_name,
            'submitted_at' => optional($this->submitted_at)?->toIso8601String(),
            'borrower_name' => $borrower?->name,
            'borrower_email' => $borrower?->email,
            'loan' => $this->whenLoaded('loan', function () {
                return [
                    'id' => $this->loan?->id,
                    'loan_number' => $this->loan?->loan_number,
                    'status' => $this->loan?->status,
                    'term_months' => (int) ($this->loan?->term_months ?? 0),
                    'assigned_officer' => $this->loan?->assignedOfficer ? [
                        'id' => $this->loan->assignedOfficer->id,
                        'name' => $this->loan->assignedOfficer->name,
                        'email' => $this->loan->assignedOfficer->email,
                    ] : null,
                    'borrower' => [
                        'id' => $this->loan?->borrower?->id,
                        'name' => $this->loan?->borrower?->name,
                        'email' => $this->loan?->borrower?->email,
                    ],
                ];
            }),
        ];
    }
}
