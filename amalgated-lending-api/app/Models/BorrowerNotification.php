<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BorrowerNotification extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'type',
        'notification_type',
        'category',
        'priority',
        'module',
        'title',
        'body',
        'resource_type',
        'resource_id',
        'route_name',
        'route_params',
        'dedupe_key',
        'data',
        'delivery_channels',
        'read_at',
        'sent_at',
        'delivered_at',
        'archived_at',
    ];

    protected $casts = [
        'data' => 'array',
        'route_params' => 'array',
        'delivery_channels' => 'array',
        'read_at' => 'datetime',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'archived_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
