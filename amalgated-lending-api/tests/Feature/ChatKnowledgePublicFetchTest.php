<?php

namespace Tests\Feature;

use App\Models\ChatKnowledgeDocument;
use App\Models\ChatKnowledgeSyncLog;
use App\Services\Chat\ChatKnowledgeIngestionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChatKnowledgePublicFetchTest extends TestCase
{
    use RefreshDatabase;

    public function test_ingestion_creates_public_page_document_from_fetched_html(): void
    {
        Config::set('chat_knowledge.public_site_url', 'https://example.test');
        Config::set('chat_knowledge.fetch_paths', ['/about']);
        Config::set('chat_knowledge.fetch_min_plain_chars', 50);

        $html = '<html><head><title>About Us</title></head><body><p>'.str_repeat('Company mission and lending services in Davao. ', 20).'</p></body></html>';
        Http::fake([
            'https://example.test/about' => Http::response($html, 200),
        ]);

        $ingestion = app(ChatKnowledgeIngestionService::class);
        $stats = $ingestion->syncAll(false);

        $this->assertSame(1, $stats['fetch_pages_processed']);
        $this->assertSame(0, $stats['fetch_http_errors']);
        $this->assertSame(0, $stats['fetch_pages_too_short']);

        $doc = ChatKnowledgeDocument::query()->where('source_type', 'public_page')->first();
        $this->assertNotNull($doc);
        $this->assertStringContainsString('Company mission', (string) $doc->content_raw);
        $this->assertSame('https://example.test/about', $doc->source_url);

        $this->assertDatabaseHas('chat_knowledge_sync_logs', ['ok' => true]);
        $this->assertNotNull(ChatKnowledgeSyncLog::query()->latest('id')->value('duration_ms'));
    }

    public function test_fetch_rejects_cross_host_urls(): void
    {
        Config::set('chat_knowledge.public_site_url', 'https://example.test');
        Config::set('chat_knowledge.fetch_paths', ['https://evil.example/hijack']);

        Http::fake();

        $ingestion = app(ChatKnowledgeIngestionService::class);
        $stats = $ingestion->syncAll(false);

        $this->assertSame(1, $stats['fetch_pages_host_rejected']);
        $this->assertSame(0, ChatKnowledgeDocument::query()->where('source_type', 'public_page')->count());
    }
}
