<?php

return [
    'default_provider' => env('AI_DEFAULT_PROVIDER', 'openai'),
    'summary_model' => env('AI_SUMMARY_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),
    'chat_model' => env('AI_CHAT_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),
    'stream_model' => env('AI_STREAM_MODEL', env('OPENAI_MODEL', 'gpt-4o-mini')),
    'max_context_messages' => (int) env('AI_MAX_CONTEXT_MESSAGES', 20),
    'http_timeout' => (int) env('AI_HTTP_TIMEOUT', 60),

    'providers' => [
        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        ],
        'groq' => [
            'api_key' => env('GROQ_API_KEY'),
            'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
        ],
    ],
];
