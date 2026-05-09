<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationPreference extends Model
{
    protected $fillable = [
        'user_id',
        'in_app',
        'email',
        'sms',
        'muted_categories',
    ];

    protected $casts = [
        'in_app' => 'boolean',
        'email' => 'boolean',
        'sms' => 'boolean',
        'muted_categories' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
