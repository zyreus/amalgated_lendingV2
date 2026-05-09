<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class ComputeLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_id' => ['nullable', 'integer', 'exists:loan_products,id'],
            'product_code' => ['nullable', 'string', 'max:40'],
            'product_slug' => ['nullable', 'string', 'max:80'],
            'loan_amount' => ['required', 'numeric', 'min:1000'],
            'term_months' => ['required', 'integer', 'min:1', 'max:360'],
            'application_nature' => ['nullable', 'string', 'in:new,reloan'],
            'age' => ['nullable', 'integer', 'min:18', 'max:100'],
            'monthly_pension' => ['nullable', 'numeric', 'min:0'],
            'monthly_rate_percent_override' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'srp' => ['nullable', 'numeric', 'min:0'],
            'purchase_channel' => ['nullable', 'string', 'in:outside_office,in_office'],
        ];
    }
}
