<?php

namespace App\Services\Chat;

use App\Models\ChatKnowledgeChunk;
use App\Models\ChatKnowledgeDocument;
use App\Models\ChatKnowledgeSyncLog;
use App\Models\CmsContent;
use App\Models\LoanProduct;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class ChatKnowledgeIngestionService
{
    public function __construct(
        protected OpenAiEmbeddingService $embeddings,
    ) {}

    /**
     * Sync loan products, CMS, optional live public-page HTML fetches, then embeddings.
     */
    public function syncAll(bool $withEmbeddings = true): array
    {
        $t0 = microtime(true);
        $stats = [
            'documents_upserted' => 0,
            'documents_skipped' => 0,
            'chunks_written' => 0,
            'embeddings_set' => 0,
            'fetch_pages_processed' => 0,
            'fetch_http_errors' => 0,
            'fetch_pages_too_short' => 0,
            'fetch_pages_host_rejected' => 0,
        ];
        $errorMessage = null;

        try {
            DB::transaction(function () use (&$stats) {
                $this->ingestLoanProducts($stats);
                $this->ingestCmsContents($stats);
            });

            $this->ingestFetchedPublicPages($stats);

            if ($withEmbeddings && $this->embeddings->isConfigured()) {
                $stats['embeddings_set'] = $this->embedPendingChunks();
            }

            Cache::put('chat_knowledge:last_sync_at', now()->toIso8601String(), 86400 * 30);

            Log::info('chat_knowledge.sync_complete', $stats);
        } catch (\Throwable $e) {
            $errorMessage = $e->getMessage();
            Log::error('chat_knowledge.sync_failed', ['message' => $errorMessage]);

            throw $e;
        } finally {
            $this->writeSyncLog($stats, $t0, $errorMessage);
        }

        return $stats;
    }

    /**
     * HTTP GET configured paths on `public_site_url`, strip HTML → plain text → `public_page` documents.
     * Same-host only (mitigates SSRF). Skips very short bodies (typical empty SPA shells).
     */
    protected function ingestFetchedPublicPages(array &$stats): void
    {
        $base = rtrim((string) config('chat_knowledge.public_site_url'), '/');
        $paths = config('chat_knowledge.fetch_paths', []);
        if ($base === '' || ! is_array($paths) || $paths === []) {
            return;
        }

        $minChars = max(40, (int) config('chat_knowledge.fetch_min_plain_chars', 120));

        foreach ($paths as $path) {
            $path = trim((string) $path);
            if ($path === '') {
                continue;
            }
            $stats['fetch_pages_processed']++;

            $url = $this->resolvePublicFetchUrl($base, $path);
            if ($url === null || ! $this->isAllowedFetchUrl($base, $url)) {
                $stats['fetch_pages_host_rejected']++;
                Log::warning('chat_knowledge.fetch_host_rejected', ['path' => $path, 'url' => $url]);

                continue;
            }

            try {
                $response = Http::timeout((int) config('chat_knowledge.fetch_timeout_seconds', 25))
                    ->connectTimeout(8)
                    ->withHeaders([
                        'User-Agent' => 'AmalgatedLending-ChatKnowledgeSync/1.0 (+support@amalgatedlending.com)',
                        'Accept' => 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                    ])
                    ->get($url);
            } catch (\Throwable $e) {
                $stats['fetch_http_errors']++;
                Log::warning('chat_knowledge.fetch_http_exception', ['url' => $url, 'message' => $e->getMessage()]);

                continue;
            }

            if (! $response->successful()) {
                $stats['fetch_http_errors']++;
                Log::warning('chat_knowledge.fetch_http_status', ['url' => $url, 'status' => $response->status()]);

                continue;
            }

            $html = (string) $response->body();
            $pageTitle = $this->extractHtmlTitle($html) ?? basename(parse_url($url, PHP_URL_PATH) ?: '/') ?: 'Page';
            $plain = $this->htmlToPlainText($html);
            if (mb_strlen($plain) < $minChars) {
                $stats['fetch_pages_too_short']++;
                Log::info('chat_knowledge.fetch_too_short', ['url' => $url, 'length' => mb_strlen($plain)]);

                continue;
            }

            $lines = [
                'Source: live website page',
                'URL: '.$url,
                'Title: '.$pageTitle,
                '',
                $plain,
            ];
            $body = implode("\n", $lines);
            $checksum = hash('sha256', $body);
            $sourceKey = 'public_page:'.hash('sha256', $url);

            $this->upsertDocument(
                sourceKey: $sourceKey,
                sourceType: 'public_page',
                title: $pageTitle,
                sourceUrl: $url,
                body: $body,
                checksum: $checksum,
                meta: [
                    'fetch_path' => $path,
                    'http_status' => $response->status(),
                    'plain_length' => mb_strlen($plain),
                ],
                stats: $stats,
            );
        }
    }

    protected function resolvePublicFetchUrl(string $base, string $pathOrUrl): ?string
    {
        $pathOrUrl = trim($pathOrUrl);
        if (Str::startsWith($pathOrUrl, ['http://', 'https://'])) {
            return $pathOrUrl;
        }
        if (! Str::startsWith($pathOrUrl, '/')) {
            $pathOrUrl = '/'.$pathOrUrl;
        }

        return $base.$pathOrUrl;
    }

    protected function isAllowedFetchUrl(string $base, string $url): bool
    {
        $hBase = $this->normalizedHost(parse_url($base, PHP_URL_HOST));
        $hTarget = $this->normalizedHost(parse_url($url, PHP_URL_HOST));
        if ($hBase === null || $hTarget === null) {
            return false;
        }

        return strcasecmp($hBase, $hTarget) === 0;
    }

    protected function normalizedHost(mixed $host): ?string
    {
        if (! is_string($host) || $host === '') {
            return null;
        }
        $host = strtolower($host);

        return Str::startsWith($host, 'www.') ? substr($host, 4) : $host;
    }

    protected function extractHtmlTitle(string $html): ?string
    {
        if (preg_match('/<title[^>]*>([^<]+)<\/title>/iu', $html, $m)) {
            $t = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));

            return $t !== '' ? $t : null;
        }

        return null;
    }

    protected function htmlToPlainText(string $html): string
    {
        $html = preg_replace('#<(script|style|noscript|template)[^>]*>.*?</\\1>#is', ' ', $html) ?? $html;
        $html = preg_replace('#<!--.*?-->#s', ' ', $html) ?? $html;
        $text = strip_tags($html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/[ \t]+/u', ' ', $text) ?? $text;
        $text = preg_replace("/\n{3,}/u", "\n\n", $text) ?? $text;

        return trim($text);
    }

    protected function writeSyncLog(array $stats, float $t0, ?string $errorMessage): void
    {
        try {
            ChatKnowledgeSyncLog::query()->create([
                'ok' => $errorMessage === null,
                'stats' => $stats,
                'error_message' => $errorMessage,
                'duration_ms' => (int) round((microtime(true) - $t0) * 1000),
            ]);
        } catch (\Throwable $e) {
            Log::warning('chat_knowledge.sync_log_write_failed', ['message' => $e->getMessage()]);
        }
    }

    protected function ingestLoanProducts(array &$stats): void
    {
        $baseUrl = rtrim((string) config('chat_knowledge.public_site_url'), '/');

        $products = LoanProduct::query()
            ->with(['loanRequirements'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        foreach ($products as $p) {
            $lines = [
                'Loan product: '.$p->name,
                'Slug / code: '.($p->slug ?? '').' / '.($p->code ?? ''),
                $p->description ? 'Description: '.$p->description : null,
                $p->requirements ? 'Requirements summary: '.$p->requirements : null,
                'Interest: '.(string) $p->interest_rate.' ('.($p->rate_type ?? 'rate').')',
                'Max term (months): '.(string) ($p->max_term ?? ''),
                $p->max_amount != null ? 'Max amount (PHP): '.(string) $p->max_amount : null,
                $p->collateral ? 'Collateral: '.$p->collateral : null,
                $p->sample_computation_note ? 'Computation note: '.$p->sample_computation_note : null,
            ];

            $reqLines = $p->loanRequirements->map(fn ($r) => '• '.$r->requirement_name)->filter()->values()->all();
            if ($reqLines !== []) {
                $lines[] = 'Document checklist highlights:';
                array_push($lines, ...$reqLines);
            }

            $body = implode("\n", array_filter($lines, fn ($x) => $x !== null && $x !== ''));
            $checksum = hash('sha256', $body);

            $url = $p->slug && $baseUrl !== ''
                ? $baseUrl.'/loans/'.$p->slug
                : ($baseUrl !== '' ? $baseUrl.'/loan-products' : null);

            $this->upsertDocument(
                sourceKey: 'loan_product:'.$p->id,
                sourceType: 'loan_product',
                title: $p->name,
                sourceUrl: $url,
                body: $body,
                checksum: $checksum,
                meta: ['loan_product_id' => $p->id, 'slug' => $p->slug],
                stats: $stats,
            );
        }
    }

    protected function ingestCmsContents(array &$stats): void
    {
        foreach (CmsContent::query()->orderBy('section_key')->orderBy('locale')->cursor() as $row) {
            $rawBody = $row->body ?? '';
            $plain = trim(html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $rawBody)), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $title = trim((string) ($row->title ?? ''));
            $lines = [
                'CMS section: '.$row->section_key,
                'Locale: '.$row->locale,
                $title !== '' ? 'Title: '.$title : null,
                $plain !== '' ? $plain : null,
            ];
            $body = implode("\n", array_filter($lines, fn ($x) => $x !== null && $x !== ''));
            if ($body === '') {
                continue;
            }

            $checksum = hash('sha256', $body);

            $this->upsertDocument(
                sourceKey: 'cms:'.$row->section_key.':'.$row->locale,
                sourceType: 'cms',
                title: $title !== '' ? $title : $row->section_key,
                sourceUrl: null,
                body: $body,
                checksum: $checksum,
                meta: ['section_key' => $row->section_key, 'locale' => $row->locale],
                stats: $stats,
            );
        }
    }

    protected function upsertDocument(
        string $sourceKey,
        string $sourceType,
        ?string $title,
        ?string $sourceUrl,
        string $body,
        string $checksum,
        array $meta,
        array &$stats,
    ): void {
        $existing = ChatKnowledgeDocument::query()->where('source_key', $sourceKey)->first();
        if ($existing && $existing->checksum === $checksum) {
            $stats['documents_skipped']++;

            return;
        }

        $doc = ChatKnowledgeDocument::updateOrCreate(
            ['source_key' => $sourceKey],
            [
                'source_type' => $sourceType,
                'title' => $title,
                'source_url' => $sourceUrl,
                'checksum' => $checksum,
                'content_raw' => $body,
                'meta' => $meta,
            ],
        );

        ChatKnowledgeChunk::query()->where('chat_knowledge_document_id', $doc->id)->delete();

        $maxChars = max(400, (int) config('chat_knowledge.chunk_max_chars', 1400));
        $overlap = max(0, (int) config('chat_knowledge.chunk_overlap', 200));
        $parts = ChatKnowledgeChunker::split($body, $maxChars, $overlap);

        foreach ($parts as $i => $part) {
            ChatKnowledgeChunk::create([
                'chat_knowledge_document_id' => $doc->id,
                'chunk_index' => $i,
                'body' => $part,
                'embedding_json' => null,
            ]);
            $stats['chunks_written']++;
        }

        $stats['documents_upserted']++;
    }

    protected function embedPendingChunks(): int
    {
        $batchSize = 48;
        $updated = 0;

        ChatKnowledgeChunk::query()
            ->whereNull('embedding_json')
            ->orderBy('id')
            ->chunkById($batchSize, function ($chunks) use (&$updated) {
                /** @var \Illuminate\Support\Collection<int, ChatKnowledgeChunk> $chunks */
                $texts = $chunks->pluck('body')->all();
                $vectors = $this->embeddings->embedBatch($texts);
                foreach ($chunks->values() as $idx => $chunk) {
                    $vec = $vectors[$idx] ?? null;
                    if ($vec !== null) {
                        $chunk->embedding_json = json_encode($vec);
                        $chunk->save();
                        $updated++;
                    }
                }
            });

        return $updated;
    }
}
