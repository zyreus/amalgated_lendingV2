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
        'lot_area',
        'floor_area',
        'market_value',
        'assessed_value',
        'loan_purpose',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'lot_area' => 'decimal:2',
        'floor_area' => 'decimal:2',
        'market_value' => 'decimal:2',
        'assessed_value' => 'decimal:2',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }
}
