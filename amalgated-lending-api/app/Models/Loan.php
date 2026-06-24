<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Loan extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING_DOCUMENTS = 'pending-documents';

    public const STATUS_FOR_EVALUATION = 'for-evaluation';

    public const STATUS_UNDER_REVIEW = 'under-review';

    public const STATUS_PENDING = 'pending';

    /** @deprecated Use STATUS_PARTIALLY_APPROVED — kept for backward compatibility. */
    public const STATUS_PRE_APPROVED = 'partially-approved';

    public const STATUS_PARTIALLY_APPROVED = 'partially-approved';

    public const STATUS_APPROVED = 'approved';

    /** @deprecated Use STATUS_RELEASED — kept for backward compatibility. */
    public const STATUS_ONGOING = 'released';

    public const STATUS_RELEASED = 'released';

    public const STATUS_REJECTED = 'rejected';

    public const STATUS_CANCELLED = 'cancelled';

    public const STATUS_COMPLETED = 'completed';

    /** @return list<string> */
    public static function activeServicingStatuses(): array
    {
        return [self::STATUS_RELEASED, self::STATUS_COMPLETED, 'ongoing'];
    }

    /** Normalize legacy status values to current workflow labels. */
    public static function normalizeStatus(?string $status): string
    {
        $value = strtolower(str_replace('_', '-', trim((string) $status)));

        return match ($value) {
            'pre-approved', 'preapproved' => self::STATUS_PARTIALLY_APPROVED,
            'ongoing' => self::STATUS_RELEASED,
            'for_evaluation' => self::STATUS_FOR_EVALUATION,
            'under_review' => self::STATUS_UNDER_REVIEW,
            'pending_documents', 'pending-documents' => self::STATUS_PENDING_DOCUMENTS,
            default => $value !== '' ? $value : self::STATUS_PENDING,
        };
    }

    protected $fillable = [
        'borrower_id',
        'assigned_officer_id',
        'principal',
        'requested_principal',
        'approved_principal',
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
        'pre_approved_by',
        'pre_approved_at',
        'released_by',
        'approval_notes',
        'approval_history',
        'amount_modified_by',
        'amount_modified_at',
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
        'approved_principal' => 'decimal:2',
        'approval_history' => 'array',
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
        'amount_modified_at' => 'datetime',
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

    /** Approved loan amount for servicing (falls back to principal). */
    public function getEffectiveApprovedPrincipalAttribute(): float
    {
        return (float) ($this->approved_principal ?? $this->principal);
    }

    /** Loan-to-value ratio when collateral value is available on the linked application. */
    public function getLoanToValueRatioAttribute(): ?float
    {
        $app = $this->loanApplication;
        if (! $app) {
            return null;
        }

        $detail = $app->relationLoaded('realEstateDetail')
            ? $app->realEstateDetail
            : $app->realEstateDetail()->first();

        $marketValue = $detail?->collateralValueForLtv() ?? $app->property_value;
        if ($marketValue === null || (float) $marketValue <= 0) {
            return null;
        }

        return round(($this->effective_approved_principal / (float) $marketValue) * 100, 2);
    }

    public function preApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'pre_approved_by');
    }

    public function releaser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function amountModifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'amount_modified_by');
    }

    public function coMakers(): HasMany
    {
        return $this->hasMany(CoMaker::class);
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
