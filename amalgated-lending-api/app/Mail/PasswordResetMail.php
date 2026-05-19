<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public User $user,
        public string $resetUrl,
    ) {}

    public function build(): self
    {
        $expire = (int) config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

        return $this->subject('Reset your password — '.config('app.name', 'Amalgated Lending Inc.'))
            ->view('mail.password-reset', [
                'userName' => $this->user->name ?? 'there',
                'resetUrl' => $this->resetUrl,
                'expireMinutes' => $expire,
            ]);
    }
}
