<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackReply extends Model
{
    protected $table = 'feedback_replies';

    protected $fillable = [
        'feedback_id',
        'sender_type',
        'sender_id',
        'message',
        'attachment',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(FeedbackTicket::class, 'feedback_id');
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
