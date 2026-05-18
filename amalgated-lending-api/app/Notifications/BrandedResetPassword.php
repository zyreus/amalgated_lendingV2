<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Notifications\Messages\MailMessage;

class BrandedResetPassword extends ResetPassword
{
    public function toMail($notifiable): MailMessage
    {
        $base = rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
        $frontendUrl = $base.'/reset-password?token='.urlencode($this->token)
            .'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reset your password — '.config('app.name'))
            ->greeting('Hello '.($notifiable->name ?? 'there').',')
            ->line('We received a request to reset the password for your account.')
            ->action('Reset password', $frontendUrl)
            ->line('This link expires in '.config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60).' minutes.')
            ->line('If you did not request a reset, you can safely ignore this email.')
            ->salutation(config('app.name'));
    }
}
