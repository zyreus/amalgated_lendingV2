<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FeedbackAnalytics extends Model
{
    protected $table = 'feedback_analytics';

    protected $fillable = [
        'feedback_id',
        'resolution_time',
        'csat_score',
        'nps_score',
        'escalation_count',
        'first_response_time',
    ];

    protected $casts = [
        'resolution_time' => 'integer',
        'csat_score' => 'integer',
        'nps_score' => 'integer',
        'escalation_count' => 'integer',
        'first_response_time' => 'integer',
    ];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(FeedbackTicket::class, 'feedback_id');
    }
}
