<?php

namespace App\Mail;

use App\Mail\Concerns\EmbedsMailLogo;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class BorrowerOtpMail extends Mailable
{
    use EmbedsMailLogo;
    use Queueable;
    use SerializesModels;

    public function __construct(
        public string $borrowerName,
        public string $code,
        public int $expiresMinutes,
    ) {}

    public function build(): static
    {
        return $this->view('mail.borrower-otp', $this->mailViewData([
            'borrowerName' => $this->borrowerName,
            'code' => $this->code,
            'expiresMinutes' => $this->expiresMinutes,
        ]));
    }
}
