<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PortalMessage extends Model
{
    protected $fillable = [
        'portal_conversation_id',
        'sender_type',
        'sender_id',
        'body',
        'attachments',
        'sent_at',
        'delivered_at',
        'seen_at',
    ];

    protected $casts = [
        'attachments' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'seen_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $message): void {
            $message->sent_at ??= now();
        });
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(PortalConversation::class, 'portal_conversation_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
