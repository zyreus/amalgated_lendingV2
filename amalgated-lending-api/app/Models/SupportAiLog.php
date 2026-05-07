<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupportAiLog extends Model
{
    protected $fillable = [
        'support_conversation_id',
        'latency_ms',
        'model',
        'response_chars',
        'snippet',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(SupportConversation::class, 'support_conversation_id');
    }
}
