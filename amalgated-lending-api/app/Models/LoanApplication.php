<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class LoanApplication extends Model
{
    public const TYPE_CHATTEL = 'chattel';

    public const TYPE_REAL_ESTATE = 'real_estate';

    public const TYPE_SALARY = 'salary';

    public const TYPE_TRAVEL_ASSISTANCE = 'travel_assistance';

    public const TYPE_SSS_PENSION = 'sss_pension';

    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING = 'pending';

    public const STATUS_APPROVED = 'approved';

    public const STATUS_REJECTED = 'rejected';

    protected $fillable = [
        'user_id',
        'loan_id',
        'loan_product_id',
        'loan_type',
        'loan_amount',
        'term_months',
        'co_maker_id',
        'co_maker_name',
        'co_maker_email',
        'co_maker_phone',
        'tin_number',
        'stencil_text',
        'property_location',
        'property_value',
        'employer_name',
        'monthly_salary',
        'destination_country',
        'travel_date',
        'purpose',
        'pension_type',
        'monthly_pension',
        'age',
        'status',
        'form_data',
        'documents',
        'computed_values',
        'computation_breakdown',
        'applicant_signature',
        'spouse_signature',
        'comaker_signature',
        'submitted_at',
        'draft_step',
        'verified_at',
        'rejection_reason',
    ];

    protected $casts = [
        'property_value' => 'decimal:2',
        'loan_amount' => 'decimal:2',
        'term_months' => 'integer',
        'monthly_salary' => 'decimal:2',
        'monthly_pension' => 'decimal:2',
        'travel_date' => 'date',
        'form_data' => 'array',
        'documents' => 'array',
        'computed_values' => 'array',
        'computation_breakdown' => 'array',
        'submitted_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function isDraft(): bool
    {
        return $this->submitted_at === null;
    }

    public function scopeDraft($query)
    {
        return $query->whereNull('submitted_at');
    }

    public function scopeSubmitted($query)
    {
        return $query->whereNotNull('submitted_at');
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }

    public function loanProduct(): BelongsTo
    {
        return $this->belongsTo(LoanProduct::class, 'loan_product_id');
    }

    public function coMaker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'co_maker_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(LoanDocument::class);
    }

    public function travelLoanWizardForm(): HasOne
    {
        return $this->hasOne(TravelLoanWizardForm::class);
    }

    public function dependents(): HasMany
    {
        return $this->hasMany(LoanApplicationDependent::class);
    }

    public function contactPersons(): HasMany
    {
        return $this->hasMany(LoanApplicationContactPerson::class);
    }

    public function creditMemorandum(): HasOne
    {
        return $this->hasOne(LoanCreditMemorandum::class);
    }
}
