<?php

/**
 * Chat RAG knowledge base (MySQL `chat_knowledge_documents` + `chat_knowledge_chunks`).
 *
 * Sources:
 *   - Loan products + CMS rows (always, from DB)
 *   - Optional live HTML fetch: comma-separated paths on `public_site_url` (see `fetch_paths`)
 *
 * SPA note: pure client-rendered pages often return minimal HTML; prefer prerendered URLs,
 * CMS-backed copy, or paths that resolve to HTML with real body text.
 */
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

    /**
     * Relative paths (e.g. `/,/loan-products,/privacy`) or absolute URLs on the **same host**
     * as `public_site_url`. Fetched HTML is stripped to plain text and stored as `source_type`
     * `public_page` for RAG. Empty = skip network fetch.
     */
    'fetch_paths' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('CHAT_KNOWLEDGE_FETCH_PATHS', ''))
    ))),

    /** Minimum stripped plain-text length to accept a fetched page (SPA shells are often tiny). */
    'fetch_min_plain_chars' => (int) env('CHAT_KNOWLEDGE_FETCH_MIN_CHARS', 120),

    'fetch_timeout_seconds' => (int) env('CHAT_KNOWLEDGE_FETCH_TIMEOUT', 25),
];
