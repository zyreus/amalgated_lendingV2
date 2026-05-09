<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackAuditLog extends Model
{
    public $timestamps = false;

    protected $table = 'feedback_audit_logs';

    protected $fillable = [
        'feedback_id',
        'actor_id',
        'action',
        'meta',
        'created_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(FeedbackTicket::class, 'feedback_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
