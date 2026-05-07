<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Message */
class MessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'chat_id' => $this->chat_id,
            'sender_type' => $this->sender_type,
            'sender_user_id' => $this->sender_user_id,
            'role' => $this->role,
            'content' => $this->content,
            'is_ai_generated' => (bool) $this->is_ai_generated,
            'provider' => $this->provider,
            'model' => $this->model,
            'parent_message_id' => $this->parent_message_id,
            'stream_request_key' => $this->stream_request_key,
            'metadata' => $this->metadata ?? [],
            'sender' => $this->whenLoaded('sender', fn () => [
                'id' => $this->sender?->id,
                'name' => $this->sender?->name,
                'email' => $this->sender?->email,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
