<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryLoanDetail extends Model
{
    protected $fillable = [
        'loan_application_id',
        'full_name',
        'birthdate',
        'civil_status',
        'address',
        'phone',
        'employer_name',
        'company_address',
        'position',
        'employment_type',
        'years_of_service',
        'monthly_gross_salary',
        'monthly_net_salary',
        'other_income',
        'loan_purpose',
    ];

    protected $casts = [
        'birthdate' => 'date',
        'years_of_service' => 'decimal:2',
        'monthly_gross_salary' => 'decimal:2',
        'monthly_net_salary' => 'decimal:2',
        'other_income' => 'decimal:2',
    ];

    public function loanApplication(): BelongsTo
    {
        return $this->belongsTo(LoanApplication::class);
    }
}
