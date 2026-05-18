<?php

namespace App\Jobs;

use App\Services\TransactionalMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendTransactionalEmailJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    /**
     * @param  array<int, array{name: string, path: string}>  $fileAttachments
     * @param  array<string, mixed>  $failureMeta
     */
    public function __construct(
        public string $toEmail,
        public string $toName,
        public string $subject,
        public string $mailableClass,
        public string $serializedMailable,
        public array $fileAttachments = [],
        public array $failureMeta = [],
    ) {}

    public function handle(TransactionalMailSender $sender): void
    {
        $mailable = unserialize($this->serializedMailable, ['allowed_classes' => true]);
        if (! is_object($mailable)) {
            return;
        }

        $sender->deliverNow($mailable, $this->toEmail, $this->toName, $this->subject, $this->failureMeta, $this->fileAttachments);
    }
}
