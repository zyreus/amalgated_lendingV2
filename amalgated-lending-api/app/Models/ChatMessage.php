<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    use HasFactory;

    protected $fillable = [
        'support_conversation_id',
        'visitor_id',
        'session_id',
        'message',
        'is_from_visitor',
        'is_from_admin',
        'admin_user_id',
        'sender_type',
        'sender_name',
        'rating',
        'routing_status',
        'is_feedback',
        'dedupe_key',
        'meta',
        'sent_at',
        'delivered_at',
        'read_at',
    ];

    protected $casts = [
        'is_from_visitor' => 'boolean',
        'is_from_admin' => 'boolean',
        'is_feedback' => 'boolean',
        'meta' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
    ];

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }

    public function supportConversation(): BelongsTo
    {
        return $this->belongsTo(SupportConversation::class, 'support_conversation_id');
    }
}
