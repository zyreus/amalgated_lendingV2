<?php

namespace App\Http\Requests\Api;

use App\Models\Chat;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'subject' => ['sometimes', 'nullable', 'string', 'max:255'],
            'channel' => ['sometimes', 'nullable', 'string', 'max:40'],
            'status' => ['sometimes', Rule::in([
                Chat::STATUS_OPEN,
                Chat::STATUS_PENDING,
                Chat::STATUS_RESOLVED,
                Chat::STATUS_ARCHIVED,
            ])],
            'customer_unread_count' => ['sometimes', 'integer', 'min:0'],
            'agent_unread_count' => ['sometimes', 'integer', 'min:0'],
            'context_window_size' => ['sometimes', 'integer', 'min:5', 'max:100'],
            'metadata' => ['sometimes', 'nullable', 'array'],
        ];
    }
}
