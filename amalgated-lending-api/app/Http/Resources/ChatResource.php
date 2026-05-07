<?php

namespace App\Http\Resources;

use App\Models\Chat;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Chat */
class ChatResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'contact_id' => $this->contact_id,
            'owner_user_id' => $this->owner_user_id,
            'subject' => $this->subject,
            'channel' => $this->channel,
            'status' => $this->status,
            'customer_unread_count' => (int) $this->customer_unread_count,
            'agent_unread_count' => (int) $this->agent_unread_count,
            'messages_count' => $this->whenCounted('messages'),
            'last_message_at' => $this->last_message_at?->toIso8601String(),
            'context_window_size' => (int) $this->context_window_size,
            'ai_summary' => $this->ai_summary,
            'ai_summary_generated_at' => $this->ai_summary_generated_at?->toIso8601String(),
            'metadata' => $this->metadata ?? [],
            'contact' => new ContactResource($this->whenLoaded('contact')),
            'latest_message' => new MessageResource($this->whenLoaded('latestMessage')),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
