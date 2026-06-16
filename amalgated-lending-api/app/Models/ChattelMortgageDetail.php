<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChattelMortgageDetail extends Model
{
    protected $fillable = [
        'loan_application_id',
        'full_name',
        'birthdate',
        'civil_status',
        'address',
        'phone',
        'vehicle_type',
        'brand',
        'model',
        'year_model',
        'plate_number',
        'engine_number',
        'chassis_number',
        'or_number',
        'cr_number',
        'market_value',
        'loan_purpose',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'year_model' => 'integer',
        'market_value' => 'decimal:2',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }
}
