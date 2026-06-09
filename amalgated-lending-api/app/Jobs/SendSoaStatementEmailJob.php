<?php

namespace App\Jobs;

use App\Models\SoaStatement;
use App\Models\SoaLog;
use App\Services\EmailNotificationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendSoaStatementEmailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 5;

    public array $backoff = [30, 120, 600, 1800];

    public function __construct(
        public int $statementId,
        public ?int $createdBy = null,
    ) {
        $this->onQueue('notifications');
    }

    public function handle(EmailNotificationService $emails): void
    {
        $statement = SoaStatement::query()->with(['borrower', 'loan'])->find($this->statementId);
        if (! $statement) {
            return;
        }

        $result = $emails->sendSoa($statement, $this->createdBy);
        if (! ($result['ok'] ?? false)) {
            throw new \RuntimeException('SOA email failed: '.($result['detail'] ?? 'send_failed'));
        }
    }

    public function failed(\Throwable $exception): void
    {
        SoaLog::query()->create([
            'soa_id' => $this->statementId,
            'action' => 'email_failed',
            'description' => 'SOA email job failed after retries: '.$exception->getMessage(),
            'created_by' => $this->createdBy,
        ]);
    }
}
