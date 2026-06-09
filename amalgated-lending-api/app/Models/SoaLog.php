<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SoaLog extends Model
{
    protected $fillable = [
        'soa_id',
        'action',
        'description',
        'created_by',
    ];

    public function statement(): BelongsTo
    {
        return $this->belongsTo(SoaStatement::class, 'soa_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
