<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BorrowerNotification extends Model
{
    protected $fillable = [
        'user_id',
        'type',
        'category',
        'priority',
        'module',
        'title',
        'body',
        'dedupe_key',
        'data',
        'delivery_channels',
        'read_at',
        'archived_at',
    ];

    protected $casts = [
        'data' => 'array',
        'delivery_channels' => 'array',
        'read_at' => 'datetime',
        'archived_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
