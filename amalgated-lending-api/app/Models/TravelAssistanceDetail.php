<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelAssistanceDetail extends Model
{
    protected $fillable = [
        'application_id',
        'travel_purpose',
        'destination_country',
        'destination_city',
        'departure_date',
        'return_date',
        'visa_status',
        'agency_name',
        'employer_name',
        'travel_cost',
        'airfare_cost',
        'visa_cost',
        'medical_cost',
        'placement_fee',
        'other_expenses',
    ];

    protected $casts = [
        'departure_date' => 'date',
        'return_date' => 'date',
        'travel_cost' => 'decimal:2',
        'airfare_cost' => 'decimal:2',
        'visa_cost' => 'decimal:2',
        'medical_cost' => 'decimal:2',
        'placement_fee' => 'decimal:2',
        'other_expenses' => 'decimal:2',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class, 'application_id');
    }
}
