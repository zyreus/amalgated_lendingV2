<?php

namespace App\Jobs;

use App\Services\NewsletterBroadcastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendNewsletterUpdateJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /**
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $announcements
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $news
     */
    public function __construct(
        public string $contentHash,
        public array $announcements,
        public array $news,
        public ?int $publishedByUserId = null,
    ) {
        $this->onQueue('notifications');
    }

    public function handle(NewsletterBroadcastService $broadcast): void
    {
        $result = $broadcast->sendUpdateEmails(
            $this->contentHash,
            $this->announcements,
            $this->news,
            $this->publishedByUserId,
        );

        Log::info('Newsletter broadcast completed', [
            'content_hash' => $this->contentHash,
            'subscriber_count' => $result['subscriber_count'],
            'sent_count' => $result['sent'],
            'failed_count' => $result['failed'],
        ]);
    }
}
