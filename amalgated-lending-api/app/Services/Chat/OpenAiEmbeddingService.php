<?php

namespace App\Services\Chat;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiEmbeddingService
{
    public function isConfigured(): bool
    {
        $key = config('chat_knowledge.openai_api_key');

        return is_string($key) && $key !== '';
    }

    /**
     * @param  array<int, string>  $inputs
     * @return array<int, array<int, float>|null> vectors aligned with inputs
     */
    public function embedBatch(array $inputs): array
    {
        if (! $this->isConfigured() || $inputs === []) {
            return array_fill(0, count($inputs), null);
        }

        $model = config('chat_knowledge.embedding_model', 'text-embedding-3-small');
        $key = config('chat_knowledge.openai_api_key');

        try {
            $response = Http::timeout(120)
                ->withToken($key)
                ->post('https://api.openai.com/v1/embeddings', [
                    'model' => $model,
                    'input' => array_values($inputs),
                ]);

            if (! $response->successful()) {
                Log::warning('chat_knowledge.embeddings_http', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);

                return array_fill(0, count($inputs), null);
            }

            $data = $response->json('data');
            if (! is_array($data)) {
                return array_fill(0, count($inputs), null);
            }

            usort($data, fn ($a, $b) => ($a['index'] ?? 0) <=> ($b['index'] ?? 0));

            $out = [];
            foreach ($data as $row) {
                $emb = $row['embedding'] ?? null;
                $out[] = is_array($emb) ? array_map('floatval', $emb) : null;
            }

            while (count($out) < count($inputs)) {
                $out[] = null;
            }

            return $out;
        } catch (\Throwable $e) {
            Log::error('chat_knowledge.embeddings_exception', ['message' => $e->getMessage()]);

            return array_fill(0, count($inputs), null);
        }
    }

    /** @return array<int, float>|null */
    public function embedOne(string $text): ?array
    {
        $batch = $this->embedBatch([$text]);

        return $batch[0] ?? null;
    }
}
