<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreLoanApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'loan_product_id' => ['required', 'integer', 'exists:loan_products,id'],
            'loan_amount' => ['required', 'numeric', 'min:1000'],
            'term_months' => ['required', 'integer', 'min:1', 'max:360'],
            'loan_type' => ['nullable', 'string', 'max:40'],
            'application_nature' => ['required', 'string', 'in:new,reloan'],
            'status' => ['nullable', 'string', 'in:draft,pending,approved,rejected'],
            'co_maker_name' => ['nullable', 'string', 'max:255'],
            'co_maker_email' => ['nullable', 'email', 'max:255'],
            'co_maker_phone' => ['nullable', 'string', 'max:32'],
            'form_data' => ['nullable', 'array'],
            'documents' => ['nullable', 'array'],
            'age' => ['nullable', 'integer', 'min:18', 'max:100'],
            'monthly_pension' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
