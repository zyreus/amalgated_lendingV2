<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SoaStatement extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_READY = 'ready';
    public const STATUS_SENT = 'sent';
    public const STATUS_VIEWED = 'viewed';
    public const STATUS_OVERDUE = 'overdue';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'borrower_id',
        'loan_id',
        'statement_month',
        'due_date',
        'monthly_due',
        'penalties',
        'remaining_balance',
        'total_due',
        'status',
        'pdf_path',
        'email_sent',
        'email_sent_at',
        'viewed_at',
        'downloaded_at',
        'created_by',
        'snapshot',
    ];

    protected $casts = [
        'statement_month' => 'date',
        'due_date' => 'date',
        'monthly_due' => 'decimal:2',
        'penalties' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'total_due' => 'decimal:2',
        'email_sent' => 'boolean',
        'email_sent_at' => 'datetime',
        'viewed_at' => 'datetime',
        'downloaded_at' => 'datetime',
        'snapshot' => 'array',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function logs(): HasMany
    {
        return $this->hasMany(SoaLog::class, 'soa_id');
    }

    public function getStatementNumberAttribute(): string
    {
        return 'SOA-'.str_pad((string) $this->getKey(), 7, '0', STR_PAD_LEFT);
    }

    public function scopeVisibleToBorrowerPortal(Builder $query): Builder
    {
        return $query
            ->where('status', '!=', self::STATUS_PAID)
            ->whereNotExists(function ($paidPayment): void {
                $paidPayment->selectRaw('1')
                    ->from('payments')
                    ->whereColumn('payments.loan_id', 'soa_statements.loan_id')
                    ->whereColumn('payments.due_date', 'soa_statements.due_date')
                    ->where('payments.status', Payment::STATUS_PAID);
            });
    }
}
