<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLoanApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'loan_product_id' => ['sometimes', 'integer', 'exists:loan_products,id'],
            'loan_amount' => ['sometimes', 'numeric', 'min:1000'],
            'term_months' => ['sometimes', 'integer', 'min:1', 'max:360'],
            'loan_type' => ['sometimes', 'string', 'max:40'],
            'application_nature' => ['sometimes', 'string', 'in:new,reloan'],
            'status' => ['sometimes', 'string', 'in:draft,pending,approved,rejected'],
            'co_maker_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'co_maker_email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'co_maker_phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'form_data' => ['sometimes', 'nullable', 'array'],
            'documents' => ['sometimes', 'nullable', 'array'],
            'age' => ['sometimes', 'nullable', 'integer', 'min:18', 'max:100'],
            'monthly_pension' => ['sometimes', 'nullable', 'numeric', 'min:0'],
        ];
    }
}
