<?php

namespace App\Models;

use App\Services\SupportConversationHandoffService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportConversation extends Model
{
    /** CRM inbox aliases → warehouse `status` values. */
    public static function mapLifecycleToStatus(string $lifecycle): string
    {
        return match (strtolower(trim($lifecycle))) {
            'active', 'open' => SupportConversationHandoffService::STATUS_AI_ACTIVE,
            'pending' => SupportConversationHandoffService::STATUS_AI_ACTIVE,
            'closed' => SupportConversationHandoffService::STATUS_CLOSED,
            default => strtolower(trim($lifecycle)),
        };
    }

    /** Warehouse `status` → CRM inbox segment (same vocabulary as AdminChatDashboard filters). */
    public static function mapStatusToLifecycle(string $status): string
    {
        $normalized = strtolower(trim($status));

        return match ($normalized) {
            'ai_active' => 'ai_active',
            'human_assisted' => 'human_assisted',
            'closed', 'resolved' => 'closed',
            'archived' => 'archived',
            'open', 'in_progress', '' => 'ai_active',
            default => $normalized,
        };
    }

    protected $fillable = [
        'session_id',
        'visitor_id',
        'guest_name',
        'guest_email',
        'mode',
        'ai_enabled',
        'status',
        'needs_human',
        'last_responder_type',
        'assigned_to',
        'human_takeover_at',
        'unread_admin',
        'customer_rating',
        'rating_comment',
        'rated_at',
        'escalated_at',
        'resolved_at',
        'last_visitor_message_at',
        'last_staff_message_at',
        'visitor_message_count',
        'visitor_chat_locked',
        'first_agent_response_received',
        'first_agent_response_at',
        'visitor_last_seen_at',
        'staff_last_seen_at',
        'typing_last_at',
        'archived_at',
    ];

    protected $casts = [
        'needs_human' => 'boolean',
        'ai_enabled' => 'boolean',
        'human_takeover_at' => 'datetime',
        'rated_at' => 'datetime',
        'escalated_at' => 'datetime',
        'resolved_at' => 'datetime',
        'last_visitor_message_at' => 'datetime',
        'last_staff_message_at' => 'datetime',
        'visitor_message_count' => 'integer',
        'visitor_chat_locked' => 'boolean',
        'first_agent_response_received' => 'boolean',
        'first_agent_response_at' => 'datetime',
        'visitor_last_seen_at' => 'datetime',
        'staff_last_seen_at' => 'datetime',
        'typing_last_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'support_conversation_id');
    }

    public function aiLogs(): HasMany
    {
        return $this->hasMany(SupportAiLog::class, 'support_conversation_id');
    }
}
