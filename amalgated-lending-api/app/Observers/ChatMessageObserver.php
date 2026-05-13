<?php

namespace App\Observers;

use App\Models\ChatMessage;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;

class ChatMessageObserver
{
    public function creating(ChatMessage $message): void
    {
        if ($message->sent_at === null) {
            $message->sent_at = Date::now();
        }
    }

    public function saved(ChatMessage $message): void
    {
        if (! $message->support_conversation_id) {
            return;
        }

        if ((bool) $message->is_feedback) {
            return;
        }

        $this->refreshConversationLastMessageAt((int) $message->support_conversation_id);
    }

    public function deleted(ChatMessage $message): void
    {
        if (! $message->support_conversation_id) {
            return;
        }

        if ((bool) $message->is_feedback) {
            return;
        }

        $this->refreshConversationLastMessageAt((int) $message->support_conversation_id);
    }

    private function refreshConversationLastMessageAt(int $supportConversationId): void
    {
        $row = DB::table('chat_messages')
            ->where('support_conversation_id', $supportConversationId)
            ->where(function ($q): void {
                $q->where('is_feedback', false)->orWhereNull('is_feedback');
            })
            ->orderByDesc(DB::raw('COALESCE(sent_at, created_at)'))
            ->orderByDesc('id')
            ->selectRaw('COALESCE(sent_at, created_at) as activity_at')
            ->first();

        $activity = $row->activity_at ?? null;

        DB::table('support_conversations')
            ->where('id', $supportConversationId)
            ->update([
                'last_message_at' => $activity,
                'updated_at' => Date::now(),
            ]);
    }
}
