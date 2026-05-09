<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrintableFormLog extends Model
{
    protected $fillable = [
        'printable_form_id',
        'user_id',
        'actor_type',
        'action',
        'storage_path',
        'ip_address',
        'user_agent',
        'meta',
        'generated_at',
        'downloaded_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'generated_at' => 'datetime',
        'downloaded_at' => 'datetime',
    ];

    public function printableForm(): BelongsTo
    {
        return $this->belongsTo(PrintableForm::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
