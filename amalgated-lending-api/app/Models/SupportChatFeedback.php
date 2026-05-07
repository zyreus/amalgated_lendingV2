<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportChatFeedback extends Model
{
    protected $table = 'support_chat_feedback';

    protected $fillable = [
        'support_conversation_id',
        'session_id',
        'rating',
        'name',
        'email',
        'subject',
        'comment',
        'status',
        'read_at',
        'replied_at',
        'is_from_sync',
    ];

    protected $casts = [
        'is_from_sync' => 'boolean',
        'read_at' => 'datetime',
        'replied_at' => 'datetime',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(SupportConversation::class, 'support_conversation_id');
    }
}
