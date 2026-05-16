<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoanHealthMetric extends Model
{
    public const STATUS_HEALTHY = 'healthy';

    public const STATUS_WATCHLIST = 'watchlist';

    public const STATUS_DELAYED = 'delayed';

    public const STATUS_HIGH_RISK = 'high_risk';

    public const STATUS_DEFAULT_RISK = 'default_risk';

    protected $fillable = [
        'loan_id',
        'health_status',
        'overdue_days',
        'missed_payments',
        'delayed_payments',
        'penalties',
        'payment_consistency',
        'restructuring_count',
        'current_overdue_amount',
    ];

    protected $casts = [
        'penalties' => 'decimal:2',
        'payment_consistency' => 'decimal:2',
        'current_overdue_amount' => 'decimal:2',
    ];

    public function loan(): BelongsTo
    {
        return $this->belongsTo(Loan::class);
    }
}
