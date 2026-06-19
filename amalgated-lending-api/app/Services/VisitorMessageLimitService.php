<?php

namespace App\Services;

use App\Models\SupportConversation;
use App\Models\SystemSetting;
use Illuminate\Support\Carbon;

/**
 * Pre-first-agent-reply limit: visitors may send at most N messages before any staff reply.
 * After the first admin reply, counting and locking are permanently disabled for the conversation.
 */
class VisitorMessageLimitService
{
    public const SETTING_KEY = 'website_chat';

    public const DEFAULT_LIMIT = 8;

    /** @var list<int> */
    public const ALLOWED_LIMITS = [5, 8, 10, 15];

    public const LOCK_MESSAGE = 'Your inquiry has been received. Please wait for a Support Agent to respond before sending additional messages.';

    public static function getMaxBeforeFirstReply(): int
    {
        $row = SystemSetting::query()->where('key', self::SETTING_KEY)->first();
        $value = is_array($row?->value) ? $row->value : [];
        $raw = (int) (
            $value['max_visitor_messages_before_first_reply']
            ?? $value['max_consecutive_visitor_messages']
            ?? self::DEFAULT_LIMIT
        );

        return in_array($raw, self::ALLOWED_LIMITS, true) ? $raw : self::DEFAULT_LIMIT;
    }

    public static function isFirstReplyPhase(SupportConversation $conv): bool
    {
        return ! (bool) ($conv->first_agent_response_received ?? false);
    }

    public static function isLocked(SupportConversation $conv): bool
    {
        if (! self::isFirstReplyPhase($conv)) {
            return false;
        }

        return (bool) ($conv->visitor_chat_locked ?? false);
    }

    /**
     * Count visitor messages only before the first admin reply.
     */
    public static function recordVisitorMessage(SupportConversation $conv): SupportConversation
    {
        $conv->refresh();

        if (! self::isFirstReplyPhase($conv)) {
            $conv->last_visitor_message_at = Carbon::now();
            $conv->save();

            return $conv;
        }

        $max = self::getMaxBeforeFirstReply();
        $next = min((int) ($conv->visitor_message_count ?? 0) + 1, 999);
        $conv->visitor_message_count = $next;
        $conv->last_visitor_message_at = Carbon::now();

        $wasLocked = self::isLocked($conv);

        if ($next >= $max) {
            $conv->visitor_chat_locked = true;
            $conv->needs_human = true;
            $conv->escalated_at = $conv->escalated_at ?? Carbon::now();
        }

        $conv->save();

        if ($next >= $max && ! $wasLocked) {
            self::notifyWaitingForResponse($conv);
            NodeChatBroadcastService::relayVisitorSendLocked($conv);
        }

        return $conv;
    }

    /**
     * First staff reply permanently ends the pre-reply message limit.
     */
    public static function recordAdminFirstReply(SupportConversation $conv): void
    {
        $wasLocked = self::isLocked($conv);
        $wasFirstPhase = self::isFirstReplyPhase($conv);

        if (! $wasFirstPhase && ! $wasLocked) {
            return;
        }

        if ($wasFirstPhase) {
            $conv->first_agent_response_received = true;
            $conv->first_agent_response_at = $conv->first_agent_response_at ?? Carbon::now();
        }

        $conv->visitor_chat_locked = false;
        $conv->visitor_message_count = 0;
        $conv->save();

        if ($wasLocked || $wasFirstPhase) {
            NodeChatBroadcastService::relayVisitorSendUnlocked($conv);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public static function payload(SupportConversation $conv): array
    {
        $locked = self::isLocked($conv);
        $firstReplyReceived = (bool) ($conv->first_agent_response_received ?? false);

        return [
            'visitor_message_count' => (int) ($conv->visitor_message_count ?? 0),
            'visitor_chat_locked' => $locked,
            'first_agent_response_received' => $firstReplyReceived,
            'first_agent_response_at' => optional($conv->first_agent_response_at)?->toIso8601String(),
            'max_visitor_messages_before_first_reply' => self::getMaxBeforeFirstReply(),
            'visitor_lock_message' => $locked ? self::LOCK_MESSAGE : null,
            // Legacy aliases for older clients
            'visitor_send_locked' => $locked,
            'consecutive_visitor_messages' => (int) ($conv->visitor_message_count ?? 0),
            'max_consecutive_visitor_messages' => self::getMaxBeforeFirstReply(),
        ];
    }

    private static function notifyWaitingForResponse(SupportConversation $conv): void
    {
        $sessionId = trim((string) $conv->session_id);
        if ($sessionId === '') {
            return;
        }

        $visitorName = trim((string) ($conv->guest_name ?? ''));
        if ($visitorName === '') {
            $visitorName = 'Website Visitor';
        }

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_CRM_INQUIRY,
            'visitor_waiting_for_first_reply',
            'Visitor waiting for response.',
            'Visitor waiting for response.',
            [
                'conversation_id' => $sessionId,
                'session_id' => $sessionId,
                'support_conversation_id' => $conv->id,
                'visitor_name' => $visitorName,
                'notification_type' => 'visitor_waiting_for_first_reply',
                'visitor_message_count' => (int) $conv->visitor_message_count,
                'visitor_chat_locked' => true,
                'high_priority' => true,
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_CRM,
                'priority' => 5,
                'throttle_key' => 'visitor-first-reply-wait:'.$sessionId,
                'throttle_max' => 2,
                'throttle_decay_seconds' => 86400,
            ],
        );
    }
}
