<?php

namespace App\Services\Chat;

use App\Models\ChatKnowledgeChunk;
use App\Models\ChatKnowledgeDocument;
use App\Models\CmsContent;
use App\Models\LoanProduct;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChatKnowledgeIngestionService
{
    public function __construct(
        protected OpenAiEmbeddingService $embeddings,
    ) {}

    /**
     * Sync CMS + loan products into documents/chunks; optionally compute embeddings.
     */
    public function syncAll(bool $withEmbeddings = true): array
    {
        $stats = ['documents_upserted' => 0, 'documents_skipped' => 0, 'chunks_written' => 0, 'embeddings_set' => 0];

        DB::transaction(function () use (&$stats) {
            $this->ingestLoanProducts($stats);
            $this->ingestCmsContents($stats);
        });

        if ($withEmbeddings && $this->embeddings->isConfigured()) {
            $stats['embeddings_set'] = $this->embedPendingChunks();
        }

        Cache::put('chat_knowledge:last_sync_at', now()->toIso8601String(), 86400 * 30);

        Log::info('chat_knowledge.sync_complete', $stats);

        return $stats;
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
