<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Contact extends Model
{
    use HasFactory;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_ARCHIVED = 'archived';

    public const STATUS_BLOCKED = 'blocked';

    protected $fillable = [
        'public_id',
        'owner_user_id',
        'name',
        'email',
        'phone',
        'company',
        'job_title',
        'source',
        'status',
        'notes',
        'metadata',
        'ai_summary',
        'ai_summary_generated_at',
        'last_contacted_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'ai_summary_generated_at' => 'datetime',
        'last_contacted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $contact): void {
            if (! $contact->public_id) {
                $contact->public_id = (string) Str::uuid();
            }
        });
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function chats(): HasMany
    {
        return $this->hasMany(Chat::class)->latest('last_message_at');
    }
}
