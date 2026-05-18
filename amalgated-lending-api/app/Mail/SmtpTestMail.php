<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SmtpTestMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function build(): static
    {
        $appName = (string) config('app.name', 'Amalgated Lending');
        $sentAt = now()->toIso8601String();

        return $this->subject($appName.' — SMTP configuration test')
            ->view('mail.smtp-test', [
                'appName' => $appName,
                'sentAt' => $sentAt,
                'mailHost' => (string) config('mail.mailers.smtp.host', ''),
                'fromAddress' => (string) config('mail.from.address', ''),
            ]);
    }
}
