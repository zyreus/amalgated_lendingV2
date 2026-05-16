<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WellnessHistory extends Model
{
    public $timestamps = false;

    protected $table = 'wellness_history';

    protected $fillable = [
        'borrower_id',
        'score',
        'score_category',
        'snapshot',
        'recorded_at',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'recorded_at' => 'datetime',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }
}
