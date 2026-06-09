<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTicket extends Model
{
    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_WAITING_FOR_BORROWER = 'waiting_for_borrower';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    protected $fillable = [
        'ticket_number',
        'borrower_id',
        'loan_id',
        'assigned_to',
        'subject',
        'category',
        'priority',
        'status',
        'last_reply_at',
        'resolved_at',
        'closed_at',
        'sla_due_at',
        'satisfaction_rating',
        'satisfaction_comment',
        'metadata',
    ];

    protected $casts = [
        'last_reply_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'sla_due_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $ticket): void {
            $ticket->ticket_number ??= 'TKT-'.now()->format('Ymd').'-'.str_pad((string) random_int(1, 99999), 5, '0', STR_PAD_LEFT);
            $ticket->sla_due_at ??= now()->addHours(match ($ticket->priority) {
                'critical' => 2,
                'high' => 4,
                'medium' => 12,
                default => 24,
            });
        });
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(SupportTicketMessage::class)->orderBy('id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(SupportTicketAttachment::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(SupportTicketNote::class)->latest();
    }
}
