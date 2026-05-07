<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class PaymentListResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $borrower = $this->loan?->borrower;

        return [
            'id' => $this->id,
            'loan_id' => $this->loan_id,
            'borrower_id' => $this->loan?->borrower_id,
            'installment_no' => $this->installment_no,
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
            'receipt_url' => $this->receipt_path ? Storage::disk('public')->url($this->receipt_path) : null,
            'receipt_name' => $this->receipt_name,
            'submitted_at' => optional($this->submitted_at)?->toIso8601String(),
            'borrower_name' => $borrower?->name,
            'borrower_email' => $borrower?->email,
            'loan' => $this->whenLoaded('loan', function () {
                return [
                    'id' => $this->loan?->id,
                    'loan_number' => $this->loan?->loan_number,
                    'status' => $this->loan?->status,
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
