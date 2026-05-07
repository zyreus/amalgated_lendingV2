<?php

namespace App\Http\Requests\Api;

use App\Models\Message;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'content' => ['required', 'string', 'max:20000'],
            'sender_type' => ['nullable', Rule::in([
                Message::SENDER_CUSTOMER,
                Message::SENDER_AGENT,
                Message::SENDER_AI,
                Message::SENDER_SYSTEM,
            ])],
            'role' => ['nullable', 'string', 'max:24'],
            'parent_message_id' => ['nullable', 'integer', 'exists:messages,id'],
            'stream_request_key' => ['nullable', 'string', 'max:100'],
            'metadata' => ['nullable', 'array'],
            'request_ai_reply' => ['nullable', 'boolean'],
        ];
    }
}
