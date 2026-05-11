<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatKnowledgeDocument extends Model
{
    protected $fillable = [
        'source_key',
        'source_type',
        'title',
        'source_url',
        'checksum',
        'content_raw',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function chunks(): HasMany
    {
        return $this->hasMany(ChatKnowledgeChunk::class);
    }
}
