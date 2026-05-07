<?php

namespace App\Http\Requests\Api;

use App\Models\Chat;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'contact_id' => ['required', 'integer', 'exists:contacts,id'],
            'subject' => ['nullable', 'string', 'max:255'],
            'channel' => ['nullable', 'string', 'max:40'],
            'status' => ['nullable', Rule::in([
                Chat::STATUS_OPEN,
                Chat::STATUS_PENDING,
                Chat::STATUS_RESOLVED,
                Chat::STATUS_ARCHIVED,
            ])],
            'context_window_size' => ['nullable', 'integer', 'min:5', 'max:100'],
            'metadata' => ['nullable', 'array'],
        ];
    }
}
