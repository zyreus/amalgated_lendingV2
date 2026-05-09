<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FailedNotification extends Model
{
    protected $fillable = [
        'audience',
        'notification_id',
        'channel',
        'error_class',
        'error_message',
        'payload',
        'attempts',
        'next_retry_at',
        'resolved_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'next_retry_at' => 'datetime',
        'resolved_at' => 'datetime',
    ];
}
