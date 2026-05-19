<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PublicFormAcknowledgementMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $context
     */
    public function __construct(
        public string $recipientName,
        public string $formType,
        public string $summaryLine,
        public array $context = [],
    ) {}

    public function build(): static
    {
        $headline = match ($this->formType) {
            'newsletter' => 'You\'re on our list',
            'loan_inquiry' => 'Your loan inquiry is in our queue',
            default => 'We received your message',
        };

        return $this->subject($headline.' — '.config('app.name'))
            ->view('mail.public-form-acknowledgement', $this->mailViewData([
                'recipientName' => $this->recipientName,
                'headline' => $headline,
                'summaryLine' => $this->summaryLine,
                'formType' => $this->formType,
                'portalUrl' => rtrim((string) config('app.frontend_url', ''), '/').'/borrower',
            ]));
    }
}
