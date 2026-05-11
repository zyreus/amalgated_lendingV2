<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CareerDepartment extends Model
{
    protected $table = 'careers_departments';

    protected $fillable = [
        'name',
        'slug',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function jobs(): HasMany
    {
        return $this->hasMany(CareerJob::class, 'department_id');
    }
}
