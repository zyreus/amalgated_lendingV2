<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailVerificationLog extends Model
{
    protected $fillable = [
        'user_id',
        'event',
        'ip_address',
        'detail',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
