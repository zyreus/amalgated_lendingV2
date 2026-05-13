<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeadMessage extends Model
{
    protected $fillable = [
        'lead_id',
        'sender_type',
        'admin_user_id',
        'message',
        'attachment_path',
        'attachment_name',
        'sent_at',
        'delivered_at',
        'read_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'read_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $m): void {
            if ($m->sent_at === null) {
                $m->sent_at = now();
            }
        });
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class);
    }

    public function adminUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_user_id');
    }
}
