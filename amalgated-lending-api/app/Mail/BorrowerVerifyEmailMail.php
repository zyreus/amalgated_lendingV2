<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BorrowerVerifyEmailMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public User $user,
        public string $verificationUrl,
    ) {}

    public function build(): self
    {
        return $this->subject('Verify your email — '.config('app.name', 'Amalgated Lending Inc.'))
            ->view('mail.borrower-verify-email', [
                'borrowerName' => $this->user->name,
                'verificationUrl' => $this->verificationUrl,
                'expiresHours' => (int) config('services.borrower_verify.expires_hours', 168),
            ]);
    }
}
