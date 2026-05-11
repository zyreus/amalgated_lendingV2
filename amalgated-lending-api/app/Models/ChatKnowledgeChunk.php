<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatKnowledgeChunk extends Model
{
    protected $fillable = [
        'chat_knowledge_document_id',
        'chunk_index',
        'body',
        'embedding_json',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(ChatKnowledgeDocument::class, 'chat_knowledge_document_id');
    }
}
