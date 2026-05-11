<?php

return [
    'chunk_max_chars' => (int) env('CHAT_KNOWLEDGE_CHUNK_CHARS', 1400),
    'chunk_overlap' => (int) env('CHAT_KNOWLEDGE_CHUNK_OVERLAP', 200),
    'rag_chunk_limit' => (int) env('CHAT_KNOWLEDGE_RAG_CHUNKS', 6),
    /** Max rows scanned from `chat_knowledge_chunks` before ranking (lower = faster DB + CPU). */
    'rag_pool_scan_limit' => (int) env('CHAT_KNOWLEDGE_RAG_POOL', 48),
    'rag_context_chars' => (int) env('CHAT_KNOWLEDGE_RAG_MAX_CHARS', 6000),
    'embedding_model' => env('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
    'openai_api_key' => env('OPENAI_API_KEY'),
    'public_site_url' => env('CHAT_KNOWLEDGE_PUBLIC_SITE_URL', env('FRONTEND_APP_URL', '')),
];
