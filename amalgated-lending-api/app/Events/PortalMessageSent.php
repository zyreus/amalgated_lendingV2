<?php

namespace App\Events;

use App\Models\PortalMessage;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PortalMessageSent implements ShouldBroadcast
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public PortalMessage $message) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('portal-conversation.'.$this->message->portal_conversation_id);
    }

    public function broadcastAs(): string
    {
        return 'portal.message.sent';
    }
}
