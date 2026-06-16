<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BorrowerProfile extends Model
{
    protected $fillable = [
        'user_id',
        'first_name',
        'middle_name',
        'last_name',
        'phone_number',
        'date_of_birth',
        'gender',
        'province',
        'city',
        'barangay',
        'complete_address',
        'address',
        'monthly_income',
        'employment_status',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'monthly_income' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}

