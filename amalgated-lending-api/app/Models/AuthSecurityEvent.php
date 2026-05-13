<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuthSecurityEvent extends Model
{
    public const UPDATED_AT = null;

    public const EVENT_LOGIN_SUCCESS = 'login_success';

    public const EVENT_LOGIN_FAILED = 'login_failed';

    public const EVENT_LOGOUT = 'logout';

    protected $fillable = [
        'guard',
        'user_id',
        'event',
        'identifier',
        'ip_address',
        'user_agent',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
