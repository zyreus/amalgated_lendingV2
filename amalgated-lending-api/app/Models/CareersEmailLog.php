<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class CareersEmailLog extends Model
{
    protected $table = 'careers_email_logs';

    protected $fillable = [
        'related_type',
        'related_id',
        'to_email',
        'subject',
        'template_key',
        'status',
        'error_message',
        'meta',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function related(): MorphTo
    {
        return $this->morphTo();
    }
}
