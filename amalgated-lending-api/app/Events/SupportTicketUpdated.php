<?php

namespace App\Events;

use App\Models\SupportTicket;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SupportTicketUpdated implements ShouldBroadcast
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public SupportTicket $ticket) {}

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel('support-ticket.'.$this->ticket->id);
    }

    public function broadcastAs(): string
    {
        return 'support.ticket.updated';
    }
}
