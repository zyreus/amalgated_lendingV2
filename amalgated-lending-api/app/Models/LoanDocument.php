<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanDocument extends Model
{
    public const VERIFY_PENDING = 'pending';

    public const VERIFY_VERIFIED = 'verified';

    public const VERIFY_REJECTED = 'rejected';

    public const VERIFY_RESUBMISSION = 'requires_resubmission';

    protected $fillable = [
        'loan_application_id',
        'document_type',
        'file_path',
        'original_name',
        'verification_status',
        'verified_by',
        'verified_at',
        'review_notes',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
