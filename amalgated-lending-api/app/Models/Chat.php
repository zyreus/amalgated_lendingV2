<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Chat extends Model
{
    use HasFactory;

    public const STATUS_OPEN = 'open';

    public const STATUS_PENDING = 'pending';

    public const STATUS_RESOLVED = 'resolved';

    public const STATUS_ARCHIVED = 'archived';

    protected $fillable = [
        'public_id',
        'contact_id',
        'owner_user_id',
        'subject',
        'channel',
        'status',
        'last_message_id',
        'last_message_at',
        'customer_unread_count',
        'agent_unread_count',
        'ai_summary',
        'ai_summary_generated_at',
        'context_window_size',
        'metadata',
    ];

    protected $casts = [
        'last_message_at' => 'datetime',
        'ai_summary_generated_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $chat): void {
            if (! $chat->public_id) {
                $chat->public_id = (string) Str::uuid();
            }
        });
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->oldest('id');
    }

    public function latestMessage(): BelongsTo
    {
        return $this->belongsTo(Message::class, 'last_message_id');
    }

    public function aiUsages(): HasMany
    {
        return $this->hasMany(AiUsage::class);
    }
}
