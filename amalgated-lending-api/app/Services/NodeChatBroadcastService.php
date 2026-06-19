<?php

namespace App\Services;

use App\Models\ChatMessage;
use App\Models\SupportConversation;
use App\Services\VisitorMessageLimitService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Pushes staff replies from Laravel to the Socket.IO CRM so visitors/admin UIs receive them without Pusher/Broadcast.
 */
class NodeChatBroadcastService
{
    private static function relayUrl(string $suffix): ?string
    {
        $url = trim((string) config('services.node_chat.broadcast_url'));
        if ($url === '') {
            return null;
        }

        $base = preg_replace('#/chat-broadcast/message$#', '', $url);
        if (! is_string($base) || $base === $url) {
            $base = rtrim(preg_replace('#/api/internal/chat-broadcast/message$#', '', $url) ?: $url, '/');
        }

        return rtrim($base, '/').'/api/internal/chat-broadcast/'.$suffix;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private static function postRelay(string $suffix, array $payload): void
    {
        $url = self::relayUrl($suffix);
        $secret = (string) config('services.node_chat.broadcast_secret');

        if ($url === null || $secret === '') {
            return;
        }

        try {
            $response = Http::timeout(5)
                ->withHeaders([
                    'X-Chat-Broadcast-Secret' => $secret,
                    'Accept' => 'application/json',
                ])
                ->asJson()
                ->post($url, $payload);

            if (! $response->successful()) {
                Log::warning('node_chat.broadcast_non_success', [
                    'suffix' => $suffix,
                    'conversation' => $payload['conversation_id'] ?? null,
                    'status' => $response->status(),
                    'body' => mb_substr((string) $response->body(), 0, 500),
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('node_chat.broadcast_failed', [
                'suffix' => $suffix,
                'conversation' => $payload['conversation_id'] ?? null,
                'error' => $e->getMessage(),
            ]);
        }
    }

    public static function relayHandoff(string $sessionId, ?int $assignedAgentId = null): void
    {
        self::postRelay('handoff', [
            'conversation_id' => $sessionId,
            'assigned_to' => $assignedAgentId,
        ]);
    }

    public static function relayAdminReply(ChatMessage $message, bool $handoff = true): void
    {
        $payload = [
            'conversation_id' => $message->session_id,
            'handoff' => $handoff,
            'assigned_to' => $message->admin_user_id,
            'admin_name' => $message->adminUser?->name ?? $message->sender_name,
            'message' => [
                'id' => $message->id,
                'conversation_id' => $message->session_id,
                'sender' => 'admin',
                'content' => $message->message,
                'created_at' => optional($message->created_at)?->toIso8601String(),
                'admin_name' => $message->adminUser?->name ?? $message->sender_name,
            ],
        ];

        self::postRelay('message', $payload);
    }

    public static function relayModeChange(string $sessionId, string $mode): void
    {
        self::postRelay('mode', [
            'conversation_id' => $sessionId,
            'mode' => strtolower(trim($mode)) === 'ai' ? 'ai' : 'human',
        ]);
    }

    /**
     * Realtime staff alert when Laravel creates a website chat notification (HTTP path).
     *
     * @param  array<string, mixed>  $payload
     */
    public static function relayWebsiteChatNotification(array $payload): void
    {
        self::postRelay('website-chat-notification', $payload);
    }

    public static function relayVisitorSendLocked(SupportConversation $conv): void
    {
        self::postRelay('visitor-send-locked', [
            'conversation_id' => $conv->session_id,
            'visitor_message_count' => (int) ($conv->visitor_message_count ?? 0),
            'visitor_chat_locked' => true,
            'visitor_send_locked' => true,
            'consecutive_visitor_messages' => (int) ($conv->visitor_message_count ?? 0),
            'first_agent_response_received' => (bool) ($conv->first_agent_response_received ?? false),
            'max_visitor_messages_before_first_reply' => VisitorMessageLimitService::getMaxBeforeFirstReply(),
            'max_consecutive_visitor_messages' => VisitorMessageLimitService::getMaxBeforeFirstReply(),
            'message' => VisitorMessageLimitService::LOCK_MESSAGE,
        ]);
    }

    public static function relayVisitorSendUnlocked(SupportConversation $conv): void
    {
        self::postRelay('visitor-send-unlocked', [
            'conversation_id' => $conv->session_id,
            'visitor_message_count' => 0,
            'visitor_chat_locked' => false,
            'visitor_send_locked' => false,
            'consecutive_visitor_messages' => 0,
            'first_agent_response_received' => (bool) ($conv->first_agent_response_received ?? false),
            'first_agent_response_at' => optional($conv->first_agent_response_at)?->toIso8601String(),
        ]);
    }
}
