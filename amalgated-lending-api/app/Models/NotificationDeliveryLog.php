<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationDeliveryLog extends Model
{
    public const AUDIENCE_BORROWER = 'borrower';

    public const AUDIENCE_ADMIN = 'admin';

    protected $fillable = [
        'audience',
        'notification_id',
        'channel',
        'status',
        'detail',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];
}
