<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BorrowerOtpMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $borrowerName,
        public string $code,
        public int $expiresMinutes,
    ) {}

    public function build(): static
    {
        return $this->view('mail.borrower-otp', [
            'borrowerName' => $this->borrowerName,
            'code' => $this->code,
            'expiresMinutes' => $this->expiresMinutes,
        ]);
    }
}
