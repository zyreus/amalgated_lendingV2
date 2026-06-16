<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lead extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'email',
        'phone',
        'organization',
        'loan_type',
        'estimated_amount',
        'source',
        'source_page',
        'status',
        'is_archived',
        'archived_at',
        'initial_message',
        'chat_token',
        'last_message_at',
        'last_read_at',
        'unread_count',
    ];

    protected $casts = [
        'estimated_amount' => 'decimal:2',
        'is_archived' => 'boolean',
        'archived_at' => 'datetime',
        'last_message_at' => 'datetime',
        'last_read_at' => 'datetime',
        'unread_count' => 'integer',
    ];

    public function messages(): HasMany
    {
        return $this->hasMany(LeadMessage::class)->orderBy('id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Footer newsletter signups and legacy rows matched by message/name. */
    public function scopeNewsletter($query)
    {
        return $query->where(function ($w) {
            $w->where('source', 'newsletter')
                ->orWhereRaw('LOWER(COALESCE(initial_message, "")) LIKE ?', ['%newsletter%'])
                ->orWhereRaw('LOWER(COALESCE(initial_message, "")) LIKE ?', ['%product updates%'])
                ->orWhereRaw('LOWER(name) = ?', ['newsletter subscriber']);
        });
    }
}
