<?php

namespace App\Models;

use App\Support\PublicStorageUrl;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DocumentLoanApplication extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'loan_product_id',
        'status',
        'submitted_at',
        'signed_form_path',
        'is_signed',
        'application_form',
        'wizard_highest_passed_step',
        'valid_id_path',
        'proof_income_path',
        'additional_document_paths',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'is_signed' => 'boolean',
        'application_form' => 'array',
        'additional_document_paths' => 'array',
        'wizard_highest_passed_step' => 'integer',
    ];

    protected $appends = [
        'signed_form_url',
    ];

    public function getSignedFormUrlAttribute(): ?string
    {
        if (! $this->signed_form_path) {
            return null;
        }

        return PublicStorageUrl::absoluteUrl($this->signed_form_path);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function loanProduct(): BelongsTo
    {
        return $this->belongsTo(LoanProduct::class);
    }

    public function uploadedDocuments(): HasMany
    {
        return $this->hasMany(UploadedDocument::class);
    }
}
