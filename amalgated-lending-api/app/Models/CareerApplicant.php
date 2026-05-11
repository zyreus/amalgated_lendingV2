<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CareerApplicant extends Model
{
    protected $table = 'careers_applicants';

    protected $fillable = [
        'email',
        'phone',
        'first_name',
        'last_name',
        'portfolio_url',
    ];

    public function applications(): HasMany
    {
        return $this->hasMany(CareerApplication::class, 'careers_applicant_id');
    }

    public function getFullNameAttribute(): string
    {
        return trim($this->first_name.' '.$this->last_name);
    }
}
