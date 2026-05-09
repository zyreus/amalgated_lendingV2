<?php

namespace App\Http\Resources;

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

        return [
            'id' => $this->id,
            'loan_id' => $this->loan_id,
            'borrower_id' => $this->loan?->borrower_id,
            'installment_no' => $this->installment_no,
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
            'reference_no' => $this->reference_no,
            'payment_method' => $this->payment_method,
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
