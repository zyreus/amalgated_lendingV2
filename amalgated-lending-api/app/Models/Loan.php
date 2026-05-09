<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Loan extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_ONGOING = 'ongoing';

    public const STATUS_COMPLETED = 'completed';

    protected $fillable = [
        'borrower_id',
        'assigned_officer_id',
        'principal',
        'requested_principal',
        'term_months',
        'annual_interest_rate',
        'status',
        'rejection_reason',
        'approved_by',
        'approved_at',
        'application_payload',
        'face_photo_path',
        'face_capture_at',
        'kyc_documents',
        'document_reviews',
        'schedule_json',
        'total_interest',
        'monthly_payment',
        'outstanding_balance',
        'disbursed_at',
        'completed_at',
        'admin_notes',
    ];

    /** Human-facing ref (not a DB column) — e.g. LN-000006 for id 6. */
    protected $appends = ['loan_number', 'applied_principal'];

    protected $casts = [
        'principal' => 'decimal:2',
        'requested_principal' => 'decimal:2',
        'annual_interest_rate' => 'decimal:4',
        'application_payload' => 'array',
        'kyc_documents' => 'array',
        'document_reviews' => 'array',
        'schedule_json' => 'array',
        'total_interest' => 'decimal:2',
        'monthly_payment' => 'decimal:2',
        'outstanding_balance' => 'decimal:2',
        'approved_at' => 'datetime',
        'face_capture_at' => 'datetime',
        'disbursed_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function getLoanNumberAttribute(): string
    {
        return 'LN-'.str_pad((string) $this->getKey(), 6, '0', STR_PAD_LEFT);
    }

    /** Borrower-requested principal (falls back to principal when not migrated). */
    public function getAppliedPrincipalAttribute(): float
    {
        return (float) ($this->requested_principal ?? $this->principal);
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function assignedOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_officer_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function loanApplication(): HasOne
    {
        return $this->hasOne(LoanApplication::class);
    }

    public function receipts(): HasMany
    {
        return $this->hasMany(LoanReceipt::class);
    }
}
