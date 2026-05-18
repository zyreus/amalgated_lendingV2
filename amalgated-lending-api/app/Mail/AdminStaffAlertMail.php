<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class AdminStaffAlertMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    /**
     * @param  array<string, mixed>  $data
     */
    public function __construct(
        public string $alertTitle,
        public ?string $alertBody,
        public string $category,
        public string $actionUrl,
        public array $data = [],
    ) {}

    public function build(): static
    {
        return $this->view('mail.admin-staff-alert', [
            'alertTitle' => $this->alertTitle,
            'alertBody' => $this->alertBody,
            'category' => $this->category,
            'actionUrl' => $this->actionUrl,
            'data' => $this->data,
        ]);
    }
}
