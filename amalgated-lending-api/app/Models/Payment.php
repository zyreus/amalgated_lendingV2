<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Payment extends Model
{
    use SoftDeletes;

    public const STATUS_PENDING = 'pending';

    public const STATUS_PAID = 'paid';

    public const STATUS_PARTIAL = 'partial';

    public const STATUS_OVERDUE = 'overdue';

    public const STATUS_WAIVED = 'waived';

    public const RECEIPT_STATUS_PENDING = 'pending';

    public const RECEIPT_STATUS_PARTIAL_RECEIPT = 'partial_receipt';

    public const RECEIPT_STATUS_FULLY_RECEIPTED = 'fully_receipted';

    public const RECEIPT_STATUS_VERIFIED = 'verified';

    public const RECEIPT_STATUS_APPROVED = 'approved';

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
        'reminder_sent_at',
        'submitted_at',
        'status',
        'source',
        'payment_method',
        'payment_type',
        'receipt_path',
        'receipt_name',
        'external_ref',
        'reference_number',
        'official_receipt_number',
        'acknowledgement_receipt_number',
        'receipt_issued_by',
        'receipt_issued_role',
        'receipt_issued_at',
        'verified_by',
        'verified_at',
        'approved_by',
        'approved_at',
        'rejected_at',
        'receipt_status',
        'recorded_by',
        'processed_by_user_id',
        'processed_by_name',
        'encoded_by',
        'encoder_name',
        'encoder_role',
        'notes',
        'is_final_payment',
        'original_amount_due',
        'adjusted_by',
        'adjustment_reason',
        'adjusted_at',
        'confirmed_by',
        'confirmation_date',
        'invoice_pdf_path',
        'receipt_pdf_path',
        'emailed_at',
        'notification_sent_at',
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
        'reminder_sent_at' => 'datetime',
        'submitted_at' => 'datetime',
        'adjusted_at' => 'datetime',
        'confirmation_date' => 'datetime',
        'receipt_issued_at' => 'datetime',
        'verified_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'emailed_at' => 'datetime',
        'notification_sent_at' => 'datetime',
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

    public function receiptIssuedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'receipt_issued_by');
    }

    public function verifiedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function approvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function recordedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public function processedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by_user_id');
    }

    public function encodedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'encoded_by');
    }

    public function receiptAudits(): HasMany
    {
        return $this->hasMany(PaymentReceiptAudit::class);
    }

    public function isPaid(): bool
    {
        return strtolower((string) $this->status) === self::STATUS_PAID;
    }
}
