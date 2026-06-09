<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LoanListResource extends JsonResource
{
    /** @return array<string, mixed> */
    protected function quotedPayloadSnippet(): array
    {
        $payload = $this->application_payload;
        if (! is_array($payload) || $payload === []) {
            return [];
        }

        return [
            'loan_product_slug' => $payload['loan_product_slug'] ?? null,
            'selected_rate_type' => $payload['selected_rate_type'] ?? null,
            'selected_interest_rate' => isset($payload['selected_interest_rate'])
                ? (float) $payload['selected_interest_rate']
                : null,
        ];
    }

    public function toArray(Request $request): array
    {
        $snippet = $this->quotedPayloadSnippet();

        return [
            'id' => $this->id,
            'loan_number' => $this->loan_number,
            'principal' => (float) $this->principal,
            'requested_principal' => $this->requested_principal !== null ? (float) $this->requested_principal : null,
            'term_months' => (int) $this->term_months,
            'annual_interest_rate' => (float) $this->annual_interest_rate,
            'loan_product_slug' => $snippet['loan_product_slug'] ?? null,
            'selected_interest_rate' => $snippet['selected_interest_rate'] ?? null,
            'selected_rate_type' => $snippet['selected_rate_type'] ?? null,
            'monthly_payment' => $this->monthly_payment != null ? (float) $this->monthly_payment : null,
            'monthly_principal' => $this->monthly_principal != null ? (float) $this->monthly_principal : null,
            'monthly_interest' => $this->monthly_interest != null ? (float) $this->monthly_interest : null,
            'whole_term_interest_percent' => $this->whole_term_interest_percent != null ? (float) $this->whole_term_interest_percent : null,
            'total_interest' => $this->total_interest != null ? (float) $this->total_interest : null,
            'total_payment' => $this->total_payment != null ? (float) $this->total_payment : null,
            'service_charge' => $this->service_charge != null ? (float) $this->service_charge : null,
            'mri_fee' => $this->mri_fee != null ? (float) $this->mri_fee : null,
            'doc_stamp' => $this->doc_stamp != null ? (float) $this->doc_stamp : null,
            'notarial_fee' => $this->notarial_fee != null ? (float) $this->notarial_fee : null,
            'mortgage_fee' => $this->mortgage_fee != null ? (float) $this->mortgage_fee : null,
            'total_deductions' => $this->total_deductions != null ? (float) $this->total_deductions : null,
            'net_proceeds' => $this->net_proceeds != null ? (float) $this->net_proceeds : null,
            'adjusted_monthly_rate_percent' => $this->adjusted_monthly_rate_percent != null ? (float) $this->adjusted_monthly_rate_percent : null,
            'outstanding_balance' => $this->outstanding_balance != null ? (float) $this->outstanding_balance : null,
            'status' => $this->status,
            'rejection_reason' => $this->rejection_reason,
            'borrower' => $this->whenLoaded('borrower', function () {
                return [
                    'id' => $this->borrower?->id,
                    'name' => $this->borrower?->name,
                    'email' => $this->borrower?->email,
                    'phone' => $this->borrower?->phone,
                ];
            }),
            'approver' => $this->whenLoaded('approver', function () {
                return [
                    'id' => $this->approver?->id,
                    'name' => $this->approver?->name,
                ];
            }),
            'assigned_officer' => $this->whenLoaded('assignedOfficer', function () {
                return [
                    'id' => $this->assignedOfficer?->id,
                    'name' => $this->assignedOfficer?->name,
                ];
            }),
            'approved_at' => optional($this->approved_at)?->toIso8601String(),
            'rejected_at' => optional($this->rejected_at)?->toIso8601String(),
            'disbursed_at' => optional($this->disbursed_at)?->toIso8601String(),
            'completed_at' => optional($this->completed_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
