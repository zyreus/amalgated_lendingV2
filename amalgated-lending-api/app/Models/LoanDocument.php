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
        'loan_id',
        'co_maker_id',
        'document_type',
        'document_category',
        'file_path',
        'original_name',
        'file_size',
        'mime_type',
        'uploaded_by',
        'uploaded_at',
        'verification_status',
        'verified_by',
        'verified_at',
        'review_notes',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'uploaded_at' => 'datetime',
        'file_size' => 'integer',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function coMaker(): BelongsTo
    {
        return $this->belongsTo(CoMaker::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }
}
