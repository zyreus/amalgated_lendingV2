<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PortalConversation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'borrower_id',
        'loan_id',
        'subject',
        'status',
        'is_pinned',
        'is_archived',
        'archived_at',
        'last_message_at',
        'borrower_last_seen_at',
        'admin_last_seen_at',
        'last_read_at',
        'unread_count',
        'metadata',
    ];

    protected $casts = [
        'is_pinned' => 'boolean',
        'is_archived' => 'boolean',
        'archived_at' => 'datetime',
        'last_message_at' => 'datetime',
        'borrower_last_seen_at' => 'datetime',
        'admin_last_seen_at' => 'datetime',
        'last_read_at' => 'datetime',
        'unread_count' => 'integer',
        'metadata' => 'array',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(PortalMessage::class)->orderBy('id');
    }
}
