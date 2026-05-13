<?php

namespace App\Observers;

use App\Models\ChatMessage;
use Illuminate\Support\Facades\Date;

class ChatMessageObserver
{
    public function creating(ChatMessage $message): void
    {
        if ($message->sent_at === null) {
            $message->sent_at = Date::now();
        }
    }
}
