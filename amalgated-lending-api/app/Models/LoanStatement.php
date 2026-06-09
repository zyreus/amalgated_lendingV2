<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanStatement extends Model
{
    protected $fillable = [
        'borrower_id',
        'loan_id',
        'loan_account_no',
        'period',
        'loan_amount',
        'remaining_balance',
        'monthly_due',
        'due_date',
    ];

    protected $casts = [
        'period' => 'date',
        'loan_amount' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'monthly_due' => 'decimal:2',
        'due_date' => 'date',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
