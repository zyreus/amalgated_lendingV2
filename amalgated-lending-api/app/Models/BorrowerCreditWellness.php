<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BorrowerCreditWellness extends Model
{
    public const CATEGORY_EXCELLENT = 'excellent';

    public const CATEGORY_GOOD = 'good';

    public const CATEGORY_FAIR = 'fair';

    public const CATEGORY_AT_RISK = 'at_risk';

    public const CATEGORY_CRITICAL = 'critical';

    protected $table = 'borrower_credit_wellness';

    protected $fillable = [
        'borrower_id',
        'wellness_score',
        'score_category',
        'repayment_rate',
        'delayed_payment_count',
        'missed_payment_count',
        'total_penalties',
        'active_loan_count',
        'default_risk_level',
        'payment_streak',
        'delayed_payment_rate',
        'avg_delay_days',
        'longest_delay_days',
        'current_overdue_amount',
        'total_outstanding_balance',
        'improvement_trend',
        'risk_flags',
        'recommendations',
        'delay_metrics',
        'eligibility_impact',
    ];

    protected $casts = [
        'repayment_rate' => 'decimal:2',
        'total_penalties' => 'decimal:2',
        'delayed_payment_rate' => 'decimal:2',
        'current_overdue_amount' => 'decimal:2',
        'total_outstanding_balance' => 'decimal:2',
        'risk_flags' => 'array',
        'recommendations' => 'array',
        'delay_metrics' => 'array',
        'eligibility_impact' => 'array',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(WellnessHistory::class, 'borrower_id', 'borrower_id');
    }
}
