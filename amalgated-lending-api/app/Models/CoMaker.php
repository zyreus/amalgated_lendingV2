<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CoMaker extends Model
{
    public const DOC_CATEGORY_VALID_ID = 'valid_id';

    public const DOC_CATEGORY_SELFIE_WITH_ID = 'selfie_with_valid_id';

    public const DOC_CATEGORY_PROOF_OF_INCOME = 'proof_of_income';

    public const DOC_CATEGORY_PROOF_OF_BILLING = 'proof_of_billing';

    public const DOC_CATEGORY_SIGNATURE = 'signature_specimen';

    public const DOC_CATEGORY_SUPPORTING = 'supporting_documents';

    public const DOC_CATEGORY_EMPLOYMENT_CERT = 'employment_certificate';

    public const DOC_CATEGORY_OTHER = 'other_attachments';

    public const VERIFY_PENDING = 'pending';

    public const VERIFY_APPROVED = 'approved';

    public const VERIFY_REJECTED = 'rejected';

    public const VERIFY_REQUIRES_RESUBMISSION = 'requires_resubmission';

    /** @var list<string> */
    public const DOCUMENT_CATEGORIES = [
        self::DOC_CATEGORY_VALID_ID,
        self::DOC_CATEGORY_SELFIE_WITH_ID,
        self::DOC_CATEGORY_PROOF_OF_INCOME,
        self::DOC_CATEGORY_PROOF_OF_BILLING,
        self::DOC_CATEGORY_SIGNATURE,
        self::DOC_CATEGORY_SUPPORTING,
        self::DOC_CATEGORY_EMPLOYMENT_CERT,
        self::DOC_CATEGORY_OTHER,
    ];

    protected $fillable = [
        'loan_application_id',
        'loan_id',
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'full_name',
        'date_of_birth',
        'civil_status',
        'address',
        'complete_address',
        'province',
        'city_municipality',
        'barangay',
        'postal_code',
        'contact_number',
        'alternate_contact_number',
        'email',
        'house_street',
        'gender',
        'age',
        'relationship_to_borrower',
        'employment_status',
        'occupation',
        'employer_business_name',
        'length_of_employment',
        'monthly_income',
        'other_income_source',
        'valid_id_type',
        'valid_id_number',
        'sort_order',
        'verification_status',
        'review_notes',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $casts = [
        'monthly_income' => 'decimal:2',
        'sort_order' => 'integer',
        'age' => 'integer',
        'date_of_birth' => 'date',
        'reviewed_at' => 'datetime',
    ];

    /** @param array<string, mixed> $data */
    public static function composeFullName(array $data): string
    {
        $parts = array_filter([
            trim((string) ($data['first_name'] ?? '')),
            trim((string) ($data['middle_name'] ?? '')),
            trim((string) ($data['last_name'] ?? '')),
        ], fn ($p) => $p !== '');
        $name = implode(' ', $parts);
        $suffix = trim((string) ($data['suffix'] ?? ''));
        if ($suffix !== '') {
            $name = trim($name.' '.$suffix);
        }

        return $name !== '' ? $name : trim((string) ($data['full_name'] ?? 'Co-Maker'));
    }

    public function displayName(): string
    {
        if ($this->first_name || $this->last_name) {
            return self::composeFullName($this->only([
                'first_name', 'middle_name', 'last_name', 'suffix', 'full_name',
            ]));
        }

        return trim((string) ($this->full_name ?? 'Co-Maker'));
    }

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(LoanDocument::class);
    }
}
