<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FeedbackTestimonialApprovedMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $recipientName,
        public string $bodyLine,
    ) {}

    public function build(): self
    {
        return $this->subject('Thank you — your testimonial is live — '.config('app.name', 'Amalgated Lending Inc.'))
            ->view('mail.feedback-testimonial-approved', [
                'recipientName' => $this->recipientName,
                'bodyLine' => $this->bodyLine,
            ]);
    }
}
