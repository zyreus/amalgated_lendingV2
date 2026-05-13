<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    protected $fillable = [
        'user_id',
        'action',
        'module',
        'record_id',
        'subject_type',
        'subject_id',
        'properties',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'properties' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(function (self $log): bool {
            return false;
        });

        static::deleting(function (self $log): bool {
            return false;
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
