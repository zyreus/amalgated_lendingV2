<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class IndexLoanApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', 'in:draft,pending,approved,rejected'],
            'loan_product_id' => ['nullable', 'integer', 'exists:loan_products,id'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'mine' => ['nullable', 'boolean'],
        ];
    }
}
