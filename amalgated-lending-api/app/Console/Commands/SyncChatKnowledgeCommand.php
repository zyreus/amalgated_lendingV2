<?php

namespace App\Console\Commands;

use App\Services\Chat\ChatKnowledgeIngestionService;
use Illuminate\Console\Command;

class SyncChatKnowledgeCommand extends Command
{
    protected $signature = 'chat:knowledge-sync {--no-embeddings : Skip OpenAI embedding generation}';

    protected $description = 'Rebuild chatbot knowledge base from loan products and CMS content';

    public function handle(ChatKnowledgeIngestionService $ingestion): int
    {
        $withEmbeddings = ! $this->option('no-embeddings');
        $this->info('Syncing chat knowledge base…');

        try {
            $stats = $ingestion->syncAll($withEmbeddings);
        } catch (\Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $this->table(array_keys($stats), [array_values($stats)]);

        return self::SUCCESS;
    }
}
