<?php

namespace App\Console\Commands;

use App\Models\FailedNotification;
use Illuminate\Console\Command;

/**
 * Placeholder hook for reprocessing rows in `failed_notifications`.
 * Extend with channel-specific retry (email/SMS workers) as outbound adapters land.
 */
class RetryFailedNotifications extends Command
{
    protected $signature = 'notifications:retry-failed {--limit=50 : Max rows to inspect}';

    protected $description = 'List pending failed notification deliveries (retry wiring is channel-specific).';

    public function handle(): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $rows = FailedNotification::query()
            ->whereNull('resolved_at')
            ->where('next_retry_at', '<=', now())
            ->orderBy('id')
            ->limit($limit)
            ->get(['id', 'audience', 'channel', 'attempts', 'error_message', 'created_at']);

        if ($rows->isEmpty()) {
            $this->info('No failed notifications pending retry.');

            return self::SUCCESS;
        }

        $this->table(
            ['id', 'audience', 'channel', 'attempts', 'created_at', 'error_message'],
            $rows->map(fn ($r) => [
                $r->id,
                $r->audience,
                $r->channel,
                $r->attempts,
                (string) $r->created_at,
                mb_substr((string) $r->error_message, 0, 80),
            ])->all()
        );

        $this->warn('Automated retry is not configured for these channels; clear or resolve rows manually if needed.');

        return self::SUCCESS;
    }
}
