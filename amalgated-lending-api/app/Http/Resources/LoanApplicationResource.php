<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoanApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'loan_product_id' => $this->loan_product_id,
            'loan_product' => $this->whenLoaded('loanProduct', fn () => new LoanProductResource($this->loanProduct)),
            'loan_amount' => $this->loan_amount !== null ? (float) $this->loan_amount : null,
            'approved_amount' => $this->approved_amount !== null ? (float) $this->approved_amount : null,
            'term_months' => $this->term_months,
            'loan_type' => $this->loan_type,
            'application_nature' => data_get($this->form_data, 'application_nature'),
            'status' => $this->status,
            'co_maker_name' => $this->co_maker_name,
            'co_maker_email' => $this->co_maker_email,
            'co_maker_phone' => $this->co_maker_phone,
            'computed_values' => $this->computed_values,
            'computation_breakdown' => $this->computation_breakdown,
            'form_data' => $this->form_data,
            'documents' => $this->documents,
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
