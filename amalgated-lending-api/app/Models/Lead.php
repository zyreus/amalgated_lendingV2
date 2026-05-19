<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lead extends Model
{
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
        'initial_message',
        'chat_token',
        'last_message_at',
    ];

    protected $casts = [
        'estimated_amount' => 'decimal:2',
        'last_message_at' => 'datetime',
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
