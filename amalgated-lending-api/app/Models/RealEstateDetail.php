<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RealEstateDetail extends Model
{
    protected $fillable = [
        'loan_application_id',
        'full_name',
        'birthdate',
        'civil_status',
        'address',
        'phone',
        'property_type',
        'title_number',
        'tax_declaration_number',
        'property_address',
        'property_description',
        'lot_area',
        'floor_area',
        'market_value',
        'assessed_value',
        'appraised_value',
        'loanable_percentage',
        'loanable_value',
        'evaluation_remarks',
        'evaluated_by',
        'evaluated_at',
        'loan_purpose',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'lot_area' => 'decimal:2',
        'floor_area' => 'decimal:2',
        'market_value' => 'decimal:2',
        'assessed_value' => 'decimal:2',
        'appraised_value' => 'decimal:2',
        'loanable_percentage' => 'decimal:2',
        'loanable_value' => 'decimal:2',
        'evaluated_at' => 'datetime',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }

    public function evaluator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'evaluated_by');
    }

    /** Collateral value used for LTV — prefers staff appraisal. */
    public function collateralValueForLtv(): ?float
    {
        foreach (['loanable_value', 'appraised_value', 'market_value'] as $key) {
            $val = $this->{$key};
            if ($val !== null && (float) $val > 0) {
                return (float) $val;
            }
        }

        return null;
    }
}
