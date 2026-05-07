<?php

namespace App\Http\Resources;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Contact */
class ContactResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'public_id' => $this->public_id,
            'owner_user_id' => $this->owner_user_id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'company' => $this->company,
            'job_title' => $this->job_title,
            'source' => $this->source,
            'status' => $this->status,
            'notes' => $this->notes,
            'metadata' => $this->metadata ?? [],
            'ai_summary' => $this->ai_summary,
            'ai_summary_generated_at' => $this->ai_summary_generated_at?->toIso8601String(),
            'last_contacted_at' => $this->last_contacted_at?->toIso8601String(),
            'chats_count' => $this->whenCounted('chats'),
            'latest_chat_at' => $this->when(isset($this->latest_chat_at), function () {
                return optional($this->latest_chat_at)->toIso8601String()
                    ?? (is_string($this->latest_chat_at) ? $this->latest_chat_at : null);
            }),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
