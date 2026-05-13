<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportConversation extends Model
{
    protected $fillable = [
        'session_id',
        'visitor_id',
        'guest_name',
        'guest_email',
        'mode',
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
        'last_visitor_message_at' => 'datetime',
        'last_staff_message_at' => 'datetime',
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
