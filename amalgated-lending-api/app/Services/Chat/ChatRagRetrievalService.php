<?php

namespace App\Services\Chat;

use App\Models\ChatKnowledgeChunk;
use Illuminate\Support\Facades\DB;

class ChatRagRetrievalService
{
    public function __construct(
        protected OpenAiEmbeddingService $embeddings,
    ) {}

    /**
     * @return array{context: string, sources: array<int, array{title: ?string, url: ?string, source_type: ?string}>}
     */
    public function retrieve(string $query, ?int $limit = null): array
    {
        $limit = $limit ?? (int) config('chat_knowledge.rag_chunk_limit', 6);
        $maxChars = (int) config('chat_knowledge.rag_context_chars', 6000);
        $poolCap = max(12, (int) config('chat_knowledge.rag_pool_scan_limit', 48));
        $fullTextCap = min(40, $poolCap);
        $queryText = trim($query);
        if ($queryText === '') {
            return ['context' => '', 'sources' => []];
        }

        $driver = DB::getDriverName();
        $pool = collect();

        if ($driver === 'mysql') {
            try {
                $pool = ChatKnowledgeChunk::query()
                    ->with('document:id,title,source_url,source_type')
                    ->whereFullText('body', $queryText)
                    ->limit($fullTextCap)
                    ->get();
            } catch (\Throwable) {
                $pool = collect();
            }
        }
        if ($pool->isEmpty()) {
            $pool = ChatKnowledgeChunk::query()
                ->with('document:id,title,source_url,source_type')
                ->orderByDesc('id')
                ->limit($poolCap)
                ->get();
        }

        $scored = [];
        $queryVec = $this->embeddings->isConfigured() ? $this->embeddings->embedOne($queryText) : null;

        foreach ($pool as $chunk) {
            $score = 0.0;
            if ($queryVec !== null && $chunk->embedding_json) {
                $vec = json_decode($chunk->embedding_json, true);
                if (is_array($vec)) {
                    $score = self::cosineSimilarity($queryVec, array_map('floatval', $vec));
                }
            }
            if ($score <= 0) {
                $score = self::keywordScore($queryText, $chunk->body);
            }
            $scored[] = ['chunk' => $chunk, 'score' => $score];
        }

        usort($scored, fn ($a, $b) => $b['score'] <=> $a['score']);
        $picked = array_slice($scored, 0, max(1, $limit));

        $lines = [];
        $sources = [];
        $used = 0;

        foreach ($picked as $row) {
            /** @var ChatKnowledgeChunk $chunk */
            $chunk = $row['chunk'];
            $doc = $chunk->document;
            $title = $doc?->title;
            $prefix = $title ? "[{$title}] " : '';
            $piece = trim($prefix.$chunk->body);
            if ($piece === '') {
                continue;
            }
            if ($used + strlen($piece) > $maxChars && $used > 0) {
                break;
            }
            $lines[] = $piece;
            $used += strlen($piece);
            $sources[] = [
                'title' => $doc?->title,
                'url' => $doc?->source_url,
                'source_type' => $doc?->source_type,
            ];
        }

        $sources = $this->uniqueSources($sources);

        $context = $lines === []
            ? ''
            : "Verified knowledge excerpts (website / CMS / loan catalogue):\n\n".implode("\n\n---\n\n", $lines);

        return ['context' => $context, 'sources' => $sources];
    }

    /**
     * @param  array<int, float>  $a
     * @param  array<int, float>  $b
     */
    public static function cosineSimilarity(array $a, array $b): float
    {
        $len = min(count($a), count($b));
        if ($len === 0) {
            return 0.0;
        }
        $dot = 0.0;
        $na = 0.0;
        $nb = 0.0;
        for ($i = 0; $i < $len; $i++) {
            $dot += $a[$i] * $b[$i];
            $na += $a[$i] ** 2;
            $nb += $b[$i] ** 2;
        }
        if ($na <= 0 || $nb <= 0) {
            return 0.0;
        }

        return $dot / (sqrt($na) * sqrt($nb));
    }

    protected static function keywordScore(string $query, string $body): float
    {
        $ql = mb_strtolower($query);
        $bl = mb_strtolower($body);
        $words = preg_split('/\s+/u', preg_replace('/[^\p{L}\p{N}\s]/u', ' ', $ql));
        $stop = ['the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'for', 'is', 'are', 'on', 'at', 'it', 'be', 'as', 'by', 'with', 'from'];
        $score = 0.0;
        foreach ($words as $w) {
            $w = trim((string) $w);
            if (mb_strlen($w) < 2 || in_array($w, $stop, true)) {
                continue;
            }
            $score += substr_count($bl, $w);
        }

        return $score > 0 ? log(1 + $score, 10) : 0.0;
    }

    /**
     * @param  array<int, array{title: ?string, url: ?string, source_type: ?string}>  $sources
     * @return array<int, array{title: ?string, url: ?string, source_type: ?string}>
     */
    protected function uniqueSources(array $sources): array
    {
        $seen = [];
        $out = [];
        foreach ($sources as $s) {
            $k = ($s['url'] ?? '').'|'.($s['title'] ?? '');
            if (isset($seen[$k])) {
                continue;
            }
            $seen[$k] = true;
            $out[] = $s;
        }

        return array_slice($out, 0, 12);
    }
}
