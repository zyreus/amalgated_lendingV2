<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_OVERDUE = 'overdue';

    public const STATUS_WAIVED = 'waived';

    protected $fillable = [
        'loan_id',
        'installment_no',
        'due_date',
        'amount_due',
        'principal_portion',
        'interest_portion',
        'amount_paid',
        'penalty_amount',
        'paid_at',
        'submitted_at',
        'status',
        'source',
        'payment_method',
        'receipt_path',
        'receipt_name',
        'external_ref',
        'reference_number',
        'official_receipt_number',
        'notes',
        'is_final_payment',
        'original_amount_due',
        'adjusted_by',
        'adjustment_reason',
        'adjusted_at',
        'confirmed_by',
        'confirmation_date',
        'invoice_pdf_path',
    ];

    protected $casts = [
        'due_date' => 'date',
        'amount_due' => 'decimal:2',
        'principal_portion' => 'decimal:2',
        'interest_portion' => 'decimal:2',
        'amount_paid' => 'decimal:2',
        'penalty_amount' => 'decimal:2',
        'original_amount_due' => 'decimal:2',
        'is_final_payment' => 'boolean',
        'paid_at' => 'datetime',
        'submitted_at' => 'datetime',
        'adjusted_at' => 'datetime',
        'confirmation_date' => 'datetime',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function adjustmentAudits(): HasMany
    {
        return $this->hasMany(PaymentAdjustmentAudit::class);
    }

    public function adjustedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }

    public function confirmedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function paymentReceipts(): HasMany
    {
        return $this->hasMany(PaymentReceipt::class);
    }
}
