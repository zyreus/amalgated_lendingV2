<?php

namespace App\Observers;

use App\Models\Message;
use Illuminate\Support\Facades\Date;

class MessageObserver
{
    public function creating(Message $message): void
    {
        if ($message->sent_at === null) {
            $message->sent_at = Date::now();
        }
    }
}
