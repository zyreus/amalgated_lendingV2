<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatKnowledgeSyncLog extends Model
{
    protected $fillable = [
        'ok',
        'stats',
        'error_message',
        'duration_ms',
    ];

    protected $casts = [
        'ok' => 'boolean',
        'stats' => 'array',
    ];
}
