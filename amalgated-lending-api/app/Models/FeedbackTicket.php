<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class FeedbackTicket extends Model
{
    protected $table = 'feedback_tickets';

    protected $fillable = [
        'borrower_id',
        'support_chat_feedback_id',
        'support_conversation_id',
        'category',
        'priority',
        'status',
        'assigned_staff_id',
        'department',
        'subject',
        'message',
        'rating',
        'sentiment_score',
        'contact_number',
        'email',
        'location',
        'is_sensitive',
        'is_vip',
        'risk_level',
        'payment_status',
        'first_response_at',
        'resolved_at',
        'closed_at',
        'follow_up_at',
        'resolution_deadline_at',
        'sla_minutes',
        'escalation_count',
        'tags',
        'checklist',
    ];

    protected $casts = [
        'rating' => 'integer',
        'sentiment_score' => 'decimal:2',
        'is_sensitive' => 'boolean',
        'is_vip' => 'boolean',
        'first_response_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'follow_up_at' => 'datetime',
        'resolution_deadline_at' => 'datetime',
        'tags' => 'array',
        'checklist' => 'array',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function supportFeedback(): BelongsTo
    {
        return $this->belongsTo(SupportChatFeedback::class, 'support_chat_feedback_id');
    }

    public function supportConversation(): BelongsTo
    {
        return $this->belongsTo(SupportConversation::class, 'support_conversation_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class, 'feedback_id')->orderBy('created_at')->orderBy('id');
    }

    public function analytics(): HasOne
    {
        return $this->hasOne(FeedbackAnalytics::class, 'feedback_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(FeedbackAuditLog::class, 'feedback_id')->latest('id');
    }
}
