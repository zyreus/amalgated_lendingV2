<?php

namespace App\Services;

use App\Models\SupportConversation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class SupportConversationHandoffService
{
    public const STATUS_AI_ACTIVE = 'ai_active';

    public const STATUS_HUMAN_ASSISTED = 'human_assisted';

    public const STATUS_CLOSED = 'closed';

    public const STATUS_ARCHIVED = 'archived';

    /** Statuses where AI must never reply. */
    private const AI_BLOCKED_STATUSES = [
        self::STATUS_HUMAN_ASSISTED,
        self::STATUS_CLOSED,
        self::STATUS_ARCHIVED,
    ];

    /**
     * Human agent takes ownership — AI must stop immediately.
     */
    public static function applyHumanTakeover(SupportConversation $conv, ?int $agentUserId = null): void
    {
        $conv->ai_enabled = false;
        $conv->mode = 'human';
        $conv->status = self::STATUS_HUMAN_ASSISTED;
        $conv->needs_human = true;
        $conv->human_takeover_at = Carbon::now();

        if ($agentUserId) {
            $conv->assigned_to = $agentUserId;
        }

        self::logDecision($conv, 'human_takeover', 'AI disabled — support agent took over.');
    }

    /**
     * Admin explicitly resumes AI assistance.
     */
    public static function resumeAi(SupportConversation $conv): void
    {
        $conv->ai_enabled = true;
        $conv->mode = 'ai';
        $conv->status = self::STATUS_AI_ACTIVE;
        $conv->needs_human = false;
        $conv->assigned_to = null;
        $conv->human_takeover_at = null;

        self::logDecision($conv, 'resume_ai', 'AI resumed — conversation returned to ai_active.');
    }

    /**
     * Single source of truth: may the chatbot generate a reply?
     *
     * @return array{allowed: bool, reason: string}
     */
    public static function evaluateAiGeneration(SupportConversation $conv): array
    {
        $conv->refresh();

        $status = strtolower((string) ($conv->status ?? ''));
        $agentId = $conv->assigned_to;

        if ($conv->ai_enabled === false) {
            return ['allowed' => false, 'reason' => 'AI blocked because ai_enabled is false.'];
        }

        if (in_array($status, self::AI_BLOCKED_STATUSES, true)) {
            return [
                'allowed' => false,
                'reason' => "AI blocked because conversation_status is \"{$status}\".",
            ];
        }

        if ($agentId) {
            return [
                'allowed' => false,
                'reason' => "AI blocked because assigned_agent_id is set ({$agentId}).",
            ];
        }

        if (strtolower((string) ($conv->mode ?? '')) === 'human') {
            return ['allowed' => false, 'reason' => 'AI blocked because mode is human.'];
        }

        return ['allowed' => true, 'reason' => 'AI allowed — conversation is not human_assisted.'];
    }

    /**
     * Upgrade legacy open/in_progress rows to ai_active when still eligible for AI.
     */
    public static function normalizeAiActiveIfEligible(SupportConversation $conv): void
    {
        $status = strtolower((string) ($conv->status ?? ''));

        if (in_array($status, self::AI_BLOCKED_STATUSES, true)) {
            return;
        }

        if ($conv->ai_enabled === false || $conv->assigned_to) {
            return;
        }

        if (strtolower((string) ($conv->mode ?? '')) === 'human') {
            return;
        }

        if ($status !== self::STATUS_AI_ACTIVE) {
            $conv->status = self::STATUS_AI_ACTIVE;
            $conv->mode = 'ai';
            $conv->save();
            self::logDecision($conv, 'status_normalized', 'Legacy status upgraded to ai_active.');
        }
    }

    public static function canGenerateAiReply(SupportConversation $conv): bool
    {
        return self::evaluateAiGeneration($conv)['allowed'];
    }

    public static function isAiBlocked(SupportConversation $conv): bool
    {
        return ! self::canGenerateAiReply($conv);
    }

    public static function isHumanAssisted(SupportConversation $conv): bool
    {
        return strtolower((string) ($conv->status ?? '')) === self::STATUS_HUMAN_ASSISTED
            || $conv->ai_enabled === false;
    }

    /**
     * @return array<string, mixed>
     */
    public static function handoffPayload(SupportConversation $conv): array
    {
        $evaluation = self::evaluateAiGeneration($conv);

        return [
            'session_id' => $conv->session_id,
            'ai_enabled' => (bool) $conv->ai_enabled,
            'conversation_status' => $conv->status,
            'status' => $conv->status,
            'mode' => $conv->mode,
            'needs_human' => (bool) $conv->needs_human,
            'assigned_agent_id' => $conv->assigned_to,
            'assigned_to' => $conv->assigned_to,
            'taken_over_at' => optional($conv->human_takeover_at)?->toIso8601String(),
            'human_takeover_at' => optional($conv->human_takeover_at)?->toIso8601String(),
            'ai_generation_allowed' => $evaluation['allowed'],
            'ai_block_reason' => $evaluation['allowed'] ? null : $evaluation['reason'],
            ...VisitorMessageLimitService::payload($conv),
        ];
    }

    public static function logDecision(SupportConversation $conv, string $event, string $message): void
    {
        Log::info('support_chat.ai_state', [
            'event' => $event,
            'conversation_id' => $conv->session_id,
            'support_conversation_id' => $conv->id,
            'ai_enabled' => $conv->ai_enabled,
            'conversation_status' => $conv->status,
            'assigned_agent_id' => $conv->assigned_to,
            'taken_over_at' => optional($conv->human_takeover_at)?->toIso8601String(),
            'message' => $message,
        ]);
    }

    public static function logAiBlocked(SupportConversation $conv, string $context): void
    {
        $evaluation = self::evaluateAiGeneration($conv);
        if ($evaluation['allowed']) {
            return;
        }

        Log::info('support_chat.ai_blocked', [
            'context' => $context,
            'conversation_id' => $conv->session_id,
            'support_conversation_id' => $conv->id,
            'ai_enabled' => $conv->ai_enabled,
            'conversation_status' => $conv->status,
            'assigned_agent_id' => $conv->assigned_to,
            'reason' => $evaluation['reason'],
        ]);
    }
}
