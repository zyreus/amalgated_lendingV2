<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Message extends Model
{
    use HasFactory;

    public const SENDER_CUSTOMER = 'customer';

    public const SENDER_AGENT = 'agent';

    public const SENDER_AI = 'ai';

    public const SENDER_SYSTEM = 'system';

    protected $fillable = [
        'public_id',
        'chat_id',
        'sender_type',
        'sender_user_id',
        'role',
        'content',
        'is_ai_generated',
        'provider',
        'model',
        'parent_message_id',
        'stream_request_key',
        'metadata',
        'sent_at',
        'delivered_at',
        'read_at',
    ];

    protected $casts = [
        'is_ai_generated' => 'boolean',
        'metadata' => 'array',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $message): void {
            if (! $message->public_id) {
                $message->public_id = (string) Str::uuid();
            }
        });
    }

    public function chat(): BelongsTo
    {
        return $this->belongsTo(Chat::class);
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_message_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_message_id');
    }

    public function aiUsages(): HasMany
    {
        return $this->hasMany(AiUsage::class);
    }
}
