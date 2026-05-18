<?php

namespace App\Jobs;

use App\Services\EmailAutomationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendPublicFormAcknowledgementJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public int $tries = 3;

    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public string $recipientEmail,
        public string $recipientName,
        public string $formType,
        public string $summaryLine,
        public array $context = [],
    ) {
        $this->onQueue('notifications');
    }

    public function handle(EmailAutomationService $automation): void
    {
        $automation->sendPublicAcknowledgement(
            $this->recipientEmail,
            $this->recipientName,
            $this->formType,
            $this->summaryLine,
            $this->context,
        );
    }
}
