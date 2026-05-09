<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AdminNotification extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'category',
        'priority',
        'module',
        'title',
        'body',
        'data',
        'delivery_channels',
        'read_at',
        'dismissed_globally_at',
    ];

    protected $casts = [
        'data' => 'array',
        'delivery_channels' => 'array',
        'read_at' => 'datetime',
        'dismissed_globally_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function userReads(): HasMany
    {
        return $this->hasMany(AdminNotificationRead::class, 'admin_notification_id');
    }
}
