<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PensionLoanDetail extends Model
{
    protected $fillable = [
        'loan_application_id',
        'full_name',
        'birthdate',
        'civil_status',
        'address',
        'phone',
        'pension_type',
        'sss_number',
        'gsis_bp_number',
        'monthly_pension',
        'pension_start_date',
        'bank_account_number',
        'loan_purpose',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'pension_start_date' => 'date',
        'monthly_pension' => 'decimal:2',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }
}
