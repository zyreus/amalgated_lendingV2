<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportConversation extends Model
{
    public const VISITOR_TYPE_AI = 'AI';

    public const VISITOR_TYPE_HUMAN = 'HUMAN';

    /** CRM lifecycle labels (maps from operational `status`). */
    public const LIFECYCLE_ACTIVE = 'active';

    public const LIFECYCLE_PENDING = 'pending';

    public const LIFECYCLE_CLOSED = 'closed';

    protected $fillable = [
        'session_id',
        'visitor_id',
        'guest_name',
        'guest_email',
        'mode',
        'visitor_type',
        'status',
        'needs_human',
        'last_responder_type',
        'assigned_to',
        'unread_admin',
        'customer_rating',
        'rating_comment',
        'rated_at',
        'escalated_at',
        'resolved_at',
        'last_message_at',
        'last_visitor_message_at',
        'last_staff_message_at',
        'visitor_last_seen_at',
        'staff_last_seen_at',
        'typing_last_at',
        'archived_at',
    ];

    protected $casts = [
        'needs_human' => 'boolean',
        'rated_at' => 'datetime',
        'escalated_at' => 'datetime',
        'resolved_at' => 'datetime',
        'last_message_at' => 'datetime',
        'last_visitor_message_at' => 'datetime',
        'last_staff_message_at' => 'datetime',
        'visitor_last_seen_at' => 'datetime',
        'staff_last_seen_at' => 'datetime',
        'typing_last_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    protected $appends = [
        'lifecycle_status',
    ];

    protected static function booted(): void
    {
        static::saving(function (self $conv): void {
            $conv->syncVisitorTypeFromMode();
        });
    }

    public function syncVisitorTypeFromMode(): void
    {
        $m = strtolower((string) ($this->mode ?? 'ai'));
        $this->visitor_type = $m === 'human' ? self::VISITOR_TYPE_HUMAN : self::VISITOR_TYPE_AI;
    }

    /**
     * Enterprise inbox segment: active = open thread, pending = staff engaged / in flight, closed = resolved or archived.
     */
    public static function mapStatusToLifecycle(?string $status): string
    {
        return match (strtolower((string) $status)) {
            'open' => self::LIFECYCLE_ACTIVE,
            'in_progress' => self::LIFECYCLE_PENDING,
            'resolved', 'archived' => self::LIFECYCLE_CLOSED,
            self::LIFECYCLE_ACTIVE, self::LIFECYCLE_PENDING, self::LIFECYCLE_CLOSED => strtolower((string) $status),
            default => self::LIFECYCLE_ACTIVE,
        };
    }

    /**
     * Reverse map for PATCH body compatibility (accepts CRM lifecycle or legacy warehouse values).
     */
    public static function mapLifecycleToStatus(string $value): string
    {
        $v = strtolower(trim($value));

        return match ($v) {
            'active' => 'open',
            'pending' => 'in_progress',
            'closed' => 'resolved',
            default => $v,
        };
    }

    public function getLifecycleStatusAttribute(): string
    {
        return self::mapStatusToLifecycle($this->status);
    }

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
