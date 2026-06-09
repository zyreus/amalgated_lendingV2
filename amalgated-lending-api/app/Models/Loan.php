<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Loan extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_PRE_APPROVED = 'pre-approved';

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
        'adjusted_monthly_rate_percent',
        'whole_term_interest_percent',
        'monthly_principal',
        'monthly_interest',
        'service_charge',
        'mri_fee',
        'doc_stamp',
        'notarial_fee',
        'mortgage_fee',
        'total_deductions',
        'net_proceeds',
        'total_payment',
        'status',
        'rejection_reason',
        'approved_by',
        'approved_at',
        'rejected_at',
        'application_payload',
        'loan_computation_snapshot',
        'admin_override_logs',
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
        'adjusted_monthly_rate_percent' => 'decimal:4',
        'whole_term_interest_percent' => 'decimal:4',
        'monthly_principal' => 'decimal:2',
        'monthly_interest' => 'decimal:2',
        'service_charge' => 'decimal:2',
        'mri_fee' => 'decimal:2',
        'doc_stamp' => 'decimal:2',
        'notarial_fee' => 'decimal:2',
        'mortgage_fee' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'net_proceeds' => 'decimal:2',
        'total_payment' => 'decimal:2',
        'application_payload' => 'array',
        'loan_computation_snapshot' => 'array',
        'admin_override_logs' => 'array',
        'kyc_documents' => 'array',
        'document_reviews' => 'array',
        'schedule_json' => 'array',
        'total_interest' => 'decimal:2',
        'monthly_payment' => 'decimal:2',
        'outstanding_balance' => 'decimal:2',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
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

    public function statements(): HasMany
    {
        return $this->hasMany(LoanStatement::class);
    }

    public function soaStatements(): HasMany
    {
        return $this->hasMany(SoaStatement::class);
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(EmailLog::class);
    }

    public function healthMetric(): HasOne
    {
        return $this->hasOne(LoanHealthMetric::class, 'loan_id');
    }
}
