<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class NewsletterUpdateMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    /**
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $announcements
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $news
     */
    public function __construct(
        public string $recipientName,
        public array $announcements,
        public array $news,
        public string $siteUrl,
    ) {}

    public function build(): static
    {
        $subject = 'News & announcements — '.config('app.name');

        return $this->subject($subject)
            ->view('mail.newsletter-update', $this->mailViewData([
                'recipientName' => $this->recipientName,
                'announcements' => $this->announcements,
                'news' => $this->news,
                'siteUrl' => $this->siteUrl,
            ]));
    }
}
