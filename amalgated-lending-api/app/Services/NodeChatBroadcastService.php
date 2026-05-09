<?php

namespace App\Services;

use App\Models\ChatMessage;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pushes staff replies from Laravel to the Socket.IO CRM so visitors/admin UIs receive them without Pusher/Broadcast.
 */
class NodeChatBroadcastService
{
    public static function relayAdminReply(ChatMessage $message): void
    {
        $url = trim((string) config('services.node_chat.broadcast_url'));
        $secret = (string) config('services.node_chat.broadcast_secret');

        if ($url === '' || $secret === '') {
            return;
        }

        $payload = [
            'conversation_id' => $message->session_id,
            'message' => [
                'id' => $message->id,
                'conversation_id' => $message->session_id,
                'sender' => 'admin',
                'content' => $message->message,
                'created_at' => optional($message->created_at)?->toIso8601String(),
                'admin_name' => $message->adminUser?->name ?? $message->sender_name,
            ],
        ];

        try {
            Http::timeout(5)
                ->withHeaders([
                    'X-Chat-Broadcast-Secret' => $secret,
                    'Accept' => 'application/json',
                ])
                ->asJson()
                ->post($url, $payload);
        } catch (\Throwable $e) {
            Log::debug('node_chat.broadcast_failed', [
                'conversation' => $message->session_id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
