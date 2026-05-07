<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoanProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'interest_rate' => (float) $this->interest_rate,
            'rate_type' => $this->rate_type,
            'max_term' => $this->max_term,
            'max_amount' => $this->max_amount !== null ? (float) $this->max_amount : null,
            'collateral_type' => $this->collateral_type,
            'status' => $this->status,
            'rules' => $this->rules,
            'calculator_config' => $this->calculator_config,
        ];
    }
}
