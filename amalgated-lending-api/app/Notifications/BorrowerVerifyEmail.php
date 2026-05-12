<?php

namespace App\Notifications;

use App\Support\BorrowerVerificationUrl;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class BorrowerVerifyEmail extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct()
    {
        $this->onQueue('notifications');
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $url = BorrowerVerificationUrl::signedVerifyUrl($notifiable);
        $hours = (int) config('services.borrower_verify.expires_hours', 168);

        return (new MailMessage)
            ->subject('Verify your email - '.config('app.name', 'Amalgated Lending Inc.'))
            ->greeting('Hello '.trim((string) ($notifiable->name ?? 'Borrower')).',')
            ->line('Please verify your email address to secure your borrower portal access.')
            ->line("This link expires in {$hours} hour(s).")
            ->action('Verify Email', $url)
            ->line('If you did not create this account, you can ignore this message.');
    }
}
