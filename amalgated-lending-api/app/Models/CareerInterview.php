<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CareerInterview extends Model
{
    protected $table = 'careers_interviews';

    protected $fillable = [
        'careers_application_id',
        'scheduled_at',
        'timezone',
        'location',
        'meeting_link',
        'interviewer_name',
        'notes',
        'outcome',
        'created_by',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(CareerApplication::class, 'careers_application_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
