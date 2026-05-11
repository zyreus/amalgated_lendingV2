<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CareerBranch extends Model
{
    protected $table = 'careers_branches';

    protected $fillable = [
        'name',
        'code',
        'address',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function jobs(): HasMany
    {
        return $this->hasMany(CareerJob::class, 'branch_id');
    }
}
