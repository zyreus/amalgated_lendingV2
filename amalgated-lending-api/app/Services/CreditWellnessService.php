<?php

namespace App\Services;

use App\Models\BorrowerCreditWellness;
use App\Models\Loan;
use App\Models\LoanHealthMetric;
use App\Models\Payment;
use App\Models\User;
use App\Models\WellnessHistory;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class CreditWellnessService
{
    public function __construct(
        private readonly CreditScoreService $creditScoreService,
        private readonly NotificationCenter $notificationCenter,
        private readonly CreditWellnessAnalytics $analytics,
    ) {}

    /**
     * Recalculate borrower wellness, per-loan health, credit score, and optional notifications.
     */
    public function recalculateForUser(User $user, bool $notify = true): BorrowerCreditWellness
    {
        $previous = BorrowerCreditWellness::query()->where('borrower_id', $user->id)->first();
        $previousScore = $previous?->wellness_score;

        $loans = Loan::query()
            ->where('borrower_id', $user->id)
            ->whereIn('status', [
                Loan::STATUS_ONGOING,
                Loan::STATUS_RELEASED,
                Loan::STATUS_COMPLETED,
                Loan::STATUS_APPROVED,
                'ongoing',
            ])
            ->get();

        $loanIds = $loans->pluck('id');
        $payments = Payment::query()
            ->whereIn('loan_id', $loanIds)
            ->orderBy('due_date')
            ->get();

        foreach ($loans as $loan) {
            $this->syncLoanHealth($loan, $payments->where('loan_id', $loan->id));
        }

        $context = $this->analytics->gatherContext($user);
        $metrics = $this->computeBorrowerMetrics($loans, $payments);
        $sufficientData = $this->analytics->hasSufficientData($user, $loans, $payments, $metrics, $context);

        $components = $this->analytics->computeComponentScores($metrics, $context);
        $score = $sufficientData ? $this->analytics->computeWeightedScore($components) : 0;
        $category = $sufficientData
            ? $this->analytics->scoreCategory($score)
            : 'insufficient';
        $defaultRisk = $sufficientData ? $this->defaultRiskLevel($score, $metrics) : 'medium';
        $trend = $sufficientData ? $this->improvementTrend($user->id, $score, $previousScore) : 'stable';
        $riskFlags = $sufficientData ? $this->predictiveRiskFlags($metrics, $loans, $payments) : [];
        $recommendations = $sufficientData ? $this->buildRecommendations($metrics, $score, $category, $riskFlags) : [];
        $decisionSupport = $sufficientData
            ? $this->analytics->decisionSupport($score, $category, $defaultRisk, $metrics, $context, $components)
            : ['recommended_loan_limit' => null, 'approval_confidence' => null, 'approval_confidence_label' => null, 'stability_score' => null, 'risk_assessment' => null];
        $eligibility = $sufficientData
            ? $this->analytics->eligibilityImpact($score, $category, $defaultRisk, $metrics, $context, $components, $decisionSupport)
            : ['insufficient_data' => true, 'decision_support' => $decisionSupport];
        $eligibility['score_breakdown'] = $sufficientData ? $this->analytics->scoreBreakdown($components) : [];
        $eligibility['achievements'] = $sufficientData
            ? $this->analytics->achievements($score, $metrics, $context, $defaultRisk)
            : [];
        $eligibility['wellness_alerts'] = $sufficientData
            ? $this->analytics->wellnessAlerts($score, $category, array_merge($metrics, ['improvement_trend' => $trend]), $context, $decisionSupport, $previousScore)
            : [['type' => 'warning', 'message' => 'Insufficient data available to calculate credit wellness. Complete your profile or submit a loan application.']];
        $eligibility['payment_consistency_rate'] = $metrics['payment_consistency_rate'] ?? 0;
        $eligibility['completed_loan_count'] = $metrics['completed_loans'] ?? 0;
        $eligibility['paid_installments'] = $metrics['paid_installments'] ?? 0;
        $eligibility['total_due_installments'] = $metrics['total_due_installments'] ?? 0;
        $eligibility['late_payments_ytd'] = $metrics['late_payments_ytd'] ?? 0;

        $wellness = BorrowerCreditWellness::query()->updateOrCreate(
            ['borrower_id' => $user->id],
            [
                'wellness_score' => $score,
                'score_category' => $category,
                'repayment_rate' => $metrics['repayment_rate'],
                'delayed_payment_count' => $metrics['delayed_count'],
                'missed_payment_count' => $metrics['missed_count'],
                'total_penalties' => $metrics['total_penalties'],
                'active_loan_count' => $metrics['active_loan_count'],
                'default_risk_level' => $defaultRisk,
                'payment_streak' => $metrics['payment_streak'],
                'delayed_payment_rate' => $metrics['delayed_rate'],
                'avg_delay_days' => $metrics['avg_delay_days'],
                'longest_delay_days' => $metrics['longest_delay_days'],
                'current_overdue_amount' => $metrics['current_overdue_amount'],
                'total_outstanding_balance' => $metrics['total_outstanding'],
                'improvement_trend' => $trend,
                'risk_flags' => $riskFlags,
                'recommendations' => $recommendations,
                'delay_metrics' => [
                    'total_delayed' => $metrics['delayed_count'],
                    'avg_delay_days' => $metrics['avg_delay_days'],
                    'longest_delay_days' => $metrics['longest_delay_days'],
                    'current_overdue_amount' => (float) $metrics['current_overdue_amount'],
                    'historical_trend' => $metrics['delay_trend'],
                ],
                'eligibility_impact' => $eligibility,
            ],
        );

        $this->recordHistory($user->id, $score, $category, $wellness, $sufficientData);
        $this->creditScoreService->recalculateForUser($user);

        if ($notify) {
            $this->maybeNotifyBorrower($user, $wellness, $previous, $previousScore);
        }

        return $wellness->fresh();
    }

    public function syncLoanHealth(Loan $loan, ?Collection $payments = null): LoanHealthMetric
    {
        $payments ??= Payment::query()->where('loan_id', $loan->id)->orderBy('due_date')->get();
        $now = Carbon::now()->startOfDay();

        $missed = 0;
        $delayed = 0;
        $penalties = 0.0;
        $overdueDaysMax = 0;
        $overdueAmount = 0.0;
        $onTime = 0;
        $evaluated = 0;

        foreach ($payments as $payment) {
            $penalties += (float) $payment->penalty_amount;

            if ((float) $payment->amount_paid > 0 && $payment->paid_at && $payment->due_date) {
                $evaluated++;
                if ($payment->paid_at->lte($payment->due_date->copy()->endOfDay())) {
                    $onTime++;
                } else {
                    $delayed++;
                    $days = $payment->paid_at->diffInDays($payment->due_date);
                    $overdueDaysMax = max($overdueDaysMax, $days);
                }
                continue;
            }

            if ($payment->due_date && $payment->due_date->lt($now)) {
                if ($payment->status === Payment::STATUS_OVERDUE
                    || ($payment->status === Payment::STATUS_PENDING && (float) $payment->amount_paid <= 0)
                    || ($payment->status === Payment::STATUS_PARTIAL && (float) $payment->amount_paid < (float) $payment->amount_due)) {
                    $days = $now->diffInDays($payment->due_date);
                    $overdueDaysMax = max($overdueDaysMax, $days);
                    $remaining = max(0, (float) $payment->amount_due - (float) $payment->amount_paid);
                    $overdueAmount += $remaining + (float) $payment->penalty_amount;

                    if ((float) $payment->amount_paid <= 0) {
                        $missed++;
                    } else {
                        $delayed++;
                    }
                }
            }
        }

        $consistency = $evaluated > 0 ? round(($onTime / $evaluated) * 100, 2) : 100.0;
        $restructureCount = $this->restructuringCount($loan);
        $status = $this->loanHealthStatus($overdueDaysMax, $missed, $delayed, $penalties, $restructureCount);

        return LoanHealthMetric::query()->updateOrCreate(
            ['loan_id' => $loan->id],
            [
                'health_status' => $status,
                'overdue_days' => min(999, $overdueDaysMax),
                'missed_payments' => $missed,
                'delayed_payments' => $delayed,
                'penalties' => round($penalties, 2),
                'payment_consistency' => $consistency,
                'restructuring_count' => $restructureCount,
                'current_overdue_amount' => round($overdueAmount, 2),
            ],
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function eligibilityImpactForUser(User $user): array
    {
        $wellness = BorrowerCreditWellness::query()->where('borrower_id', $user->id)->first();
        if ($wellness?->eligibility_impact) {
            return $wellness->eligibility_impact;
        }

        $this->recalculateForUser($user, notify: false);
        $wellness = BorrowerCreditWellness::query()->where('borrower_id', $user->id)->first();

        return $wellness?->eligibility_impact ?? [
            'insufficient_data' => true,
            'repayment_rate' => 0,
            'delayed_rate' => 0,
            'active_loan_count' => 0,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function dashboardPayload(User $user): array
    {
        $wellness = BorrowerCreditWellness::query()->where('borrower_id', $user->id)->first()
            ?? $this->recalculateForUser($user, notify: false);

        $loans = Loan::query()
            ->where('borrower_id', $user->id)
            ->whereIn('status', [Loan::STATUS_ONGOING, Loan::STATUS_APPROVED, Loan::STATUS_COMPLETED])
            ->with('healthMetric')
            ->get();

        $loanHealth = $loans->map(fn (Loan $loan) => [
            'loan_id' => $loan->id,
            'status' => $loan->status,
            'principal' => (float) $loan->principal,
            'outstanding_balance' => (float) ($loan->outstanding_balance ?? 0),
            'health_status' => $loan->healthMetric?->health_status ?? LoanHealthMetric::STATUS_HEALTHY,
            'overdue_days' => (int) ($loan->healthMetric?->overdue_days ?? 0),
            'payment_consistency' => (float) ($loan->healthMetric?->payment_consistency ?? 100),
        ])->values()->all();

        $history = WellnessHistory::query()
            ->where('borrower_id', $user->id)
            ->orderByDesc('recorded_at')
            ->limit(24)
            ->get()
            ->sortBy('recorded_at')
            ->values()
            ->map(fn (WellnessHistory $h) => [
                'score' => $h->score,
                'category' => $h->score_category,
                'recorded_at' => $h->recorded_at?->toIso8601String(),
            ]);

        $nextDue = Payment::query()
            ->whereIn('loan_id', $loans->whereIn('status', [Loan::STATUS_ONGOING, Loan::STATUS_RELEASED, 'ongoing'])->pluck('id'))
            ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_PARTIAL, Payment::STATUS_OVERDUE])
            ->whereNotNull('due_date')
            ->orderBy('due_date')
            ->first();

        $impact = is_array($wellness->eligibility_impact) ? $wellness->eligibility_impact : [];
        $insufficient = (bool) ($impact['insufficient_data'] ?? false);

        return [
            'wellness_score' => $insufficient ? null : (int) $wellness->wellness_score,
            'score_category' => $insufficient ? 'insufficient' : $wellness->score_category,
            'insufficient_data' => $insufficient,
            'credit_score' => $user->credit_score !== null ? (float) $user->credit_score : null,
            'risk_level' => $user->risk_level,
            'repayment_rate' => (float) $wellness->repayment_rate,
            'payment_consistency_rate' => (float) ($impact['payment_consistency_rate'] ?? (100 - (float) $wellness->delayed_payment_rate)),
            'delayed_payment_rate' => (float) $wellness->delayed_payment_rate,
            'payment_streak' => (int) $wellness->payment_streak,
            'active_loan_count' => (int) $wellness->active_loan_count,
            'completed_loan_count' => (int) ($impact['completed_loan_count'] ?? 0),
            'paid_installments' => (int) ($impact['paid_installments'] ?? 0),
            'total_due_installments' => (int) ($impact['total_due_installments'] ?? 0),
            'total_penalties' => (float) $wellness->total_penalties,
            'total_outstanding_balance' => (float) $wellness->total_outstanding_balance,
            'current_overdue_amount' => (float) $wellness->current_overdue_amount,
            'improvement_trend' => $wellness->improvement_trend,
            'default_risk_level' => $wellness->default_risk_level,
            'delay_metrics' => $wellness->delay_metrics,
            'risk_flags' => $wellness->risk_flags ?? [],
            'recommendations' => $wellness->recommendations ?? [],
            'eligibility_impact' => $impact,
            'decision_support' => $impact['decision_support'] ?? null,
            'score_breakdown' => $impact['score_breakdown'] ?? [],
            'achievements' => $impact['achievements'] ?? [],
            'wellness_alerts' => $impact['wellness_alerts'] ?? [],
            'loan_health' => $loanHealth,
            'history' => $history,
            'next_due_date' => $nextDue?->due_date?->toDateString(),
            'updated_at' => $wellness->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function portfolioOverview(): array
    {
        $rows = BorrowerCreditWellness::query()
            ->with('borrower:id,name,email,credit_score,risk_level')
            ->get();

        $segments = [
            BorrowerCreditWellness::CATEGORY_EXCELLENT => 0,
            BorrowerCreditWellness::CATEGORY_GOOD => 0,
            BorrowerCreditWellness::CATEGORY_FAIR => 0,
            BorrowerCreditWellness::CATEGORY_AT_RISK => 0,
            BorrowerCreditWellness::CATEGORY_CRITICAL => 0,
        ];

        foreach ($rows as $row) {
            $key = $row->score_category;
            if (isset($segments[$key])) {
                $segments[$key]++;
            }
        }

        $highRisk = $rows->filter(fn ($r) => in_array($r->score_category, [
            BorrowerCreditWellness::CATEGORY_AT_RISK,
            BorrowerCreditWellness::CATEGORY_CRITICAL,
        ], true))->take(50)->values();

        $improving = $rows->filter(fn ($r) => $r->improvement_trend === 'improving')->take(50)->values();
        $top = $rows->sortByDesc('wellness_score')->take(20)->values();

        $delayedLoans = LoanHealthMetric::query()
            ->whereIn('health_status', [
                LoanHealthMetric::STATUS_DELAYED,
                LoanHealthMetric::STATUS_HIGH_RISK,
                LoanHealthMetric::STATUS_DEFAULT_RISK,
            ])
            ->with('loan.borrower:id,name,email')
            ->orderByDesc('overdue_days')
            ->limit(50)
            ->get();

        return [
            'total_borrowers' => $rows->count(),
            'segments' => $segments,
            'avg_wellness_score' => $rows->count() > 0 ? round($rows->avg('wellness_score'), 1) : 0,
            'score_trend' => $this->portfolioScoreTrend(),
            'high_risk_borrowers' => $highRisk->map(fn ($r) => $this->adminBorrowerRow($r))->all(),
            'improving_borrowers' => $improving->map(fn ($r) => $this->adminBorrowerRow($r))->all(),
            'top_performers' => $top->map(fn ($r) => $this->adminBorrowerRow($r))->all(),
            'delayed_accounts' => $delayedLoans->map(fn (LoanHealthMetric $m) => [
                'loan_id' => $m->loan_id,
                'health_status' => $m->health_status,
                'overdue_days' => $m->overdue_days,
                'borrower' => $m->loan?->borrower ? [
                    'id' => $m->loan->borrower->id,
                    'name' => $m->loan->borrower->name,
                    'email' => $m->loan->borrower->email,
                ] : null,
            ])->all(),
        ];
    }

    /**
     * @param  Collection<int, Loan>  $loans
     * @param  Collection<int, Payment>  $payments
     * @return array<string, mixed>
     */
    private function computeBorrowerMetrics(Collection $loans, Collection $payments): array
    {
        $now = Carbon::now()->startOfDay();
        $onTime = 0;
        $delayed = 0;
        $missed = 0;
        $evaluated = 0;
        $paidInstallments = 0;
        $totalDueInstallments = 0;
        $delayDays = [];
        $totalPenalties = 0.0;
        $currentOverdue = 0.0;
        $totalOutstanding = 0.0;

        $activeStatuses = [Loan::STATUS_ONGOING, Loan::STATUS_RELEASED, Loan::STATUS_APPROVED, 'ongoing'];
        $activeLoanCount = $loans->filter(fn (Loan $l) => in_array($l->status, $activeStatuses, true))->count();

        foreach ($loans->filter(fn (Loan $l) => in_array($l->status, [Loan::STATUS_ONGOING, Loan::STATUS_RELEASED, 'ongoing'], true)) as $loan) {
            $totalOutstanding += (float) ($loan->outstanding_balance ?? 0);
        }

        foreach ($payments as $payment) {
            $totalPenalties += (float) $payment->penalty_amount;

            $isDue = $payment->due_date && $payment->due_date->lte($now);
            if ($isDue) {
                $totalDueInstallments++;
                $fullyPaid = (float) $payment->amount_paid >= (float) $payment->amount_due
                    || $payment->status === Payment::STATUS_PAID;
                if ($fullyPaid) {
                    $paidInstallments++;
                }
            }

            if ((float) $payment->amount_paid > 0 && $payment->paid_at && $payment->due_date) {
                $evaluated++;
                if ($payment->paid_at->lte($payment->due_date->copy()->endOfDay())) {
                    $onTime++;
                } else {
                    $delayed++;
                    $delayDays[] = $payment->paid_at->diffInDays($payment->due_date);
                }
                continue;
            }

            if ($payment->due_date && $payment->due_date->lt($now)) {
                if ((float) $payment->amount_paid <= 0
                    && in_array($payment->status, [Payment::STATUS_OVERDUE, Payment::STATUS_PENDING], true)) {
                    $missed++;
                    $evaluated++;
                } elseif ($payment->status === Payment::STATUS_OVERDUE
                    || ($payment->status === Payment::STATUS_PARTIAL && (float) $payment->amount_paid < (float) $payment->amount_due)) {
                    $delayed++;
                    $evaluated++;
                    $delayDays[] = $now->diffInDays($payment->due_date);
                    $currentOverdue += max(0, (float) $payment->amount_due - (float) $payment->amount_paid)
                        + (float) $payment->penalty_amount;
                }
            }
        }

        $streak = $this->computePaymentStreak($payments);
        $repaymentRate = $totalDueInstallments > 0
            ? round(($paidInstallments / $totalDueInstallments) * 100, 2)
            : ($evaluated > 0 ? round(($onTime / $evaluated) * 100, 2) : 0.0);
        $paymentConsistencyRate = $evaluated > 0 ? round(($onTime / $evaluated) * 100, 2) : 100.0;
        $delayedRate = $evaluated > 0 ? round(($delayed / $evaluated) * 100, 2) : 0.0;

        $recentDelayed = $payments->filter(function (Payment $p) use ($now) {
            if (! $p->due_date || $p->due_date->lt($now->copy()->subMonths(3))) {
                return false;
            }

            return $p->status === Payment::STATUS_OVERDUE
                || ($p->paid_at && $p->due_date && $p->paid_at->gt($p->due_date->copy()->endOfDay()));
        })->count();

        $olderDelayed = $payments->filter(function (Payment $p) use ($now) {
            if (! $p->due_date || $p->due_date->gte($now->copy()->subMonths(3)) || $p->due_date->gte($now)) {
                return false;
            }

            return $p->status === Payment::STATUS_OVERDUE
                || ($p->paid_at && $p->due_date && $p->paid_at->gt($p->due_date->copy()->endOfDay()));
        })->count();

        $delayTrend = 'stable';
        if ($recentDelayed > $olderDelayed + 1) {
            $delayTrend = 'worsening';
        } elseif ($recentDelayed < $olderDelayed) {
            $delayTrend = 'improving';
        }

        $defaultedLoans = LoanHealthMetric::query()
            ->whereIn('loan_id', $loans->pluck('id'))
            ->where('health_status', LoanHealthMetric::STATUS_DEFAULT_RISK)
            ->count();

        return [
            'on_time' => $onTime,
            'delayed_count' => $delayed,
            'missed_count' => $missed,
            'evaluated' => $evaluated,
            'paid_installments' => $paidInstallments,
            'total_due_installments' => $totalDueInstallments,
            'repayment_rate' => $repaymentRate,
            'payment_consistency_rate' => $paymentConsistencyRate,
            'delayed_rate' => $delayedRate,
            'payment_streak' => $streak,
            'avg_delay_days' => count($delayDays) > 0 ? (int) round(array_sum($delayDays) / count($delayDays)) : 0,
            'longest_delay_days' => count($delayDays) > 0 ? (int) max($delayDays) : 0,
            'total_penalties' => round($totalPenalties, 2),
            'current_overdue_amount' => round($currentOverdue, 2),
            'total_outstanding' => round($totalOutstanding, 2),
            'active_loan_count' => $activeLoanCount,
            'completed_loans' => $loans->where('status', Loan::STATUS_COMPLETED)->count(),
            'defaulted_loans' => $defaultedLoans,
            'late_payments_ytd' => $this->analytics->countLatePaymentsYtd($payments),
            'delay_trend' => $delayTrend,
        ];
    }

    private function computePaymentStreak(Collection $payments): int
    {
        $paid = $payments
            ->filter(fn (Payment $p) => (float) $p->amount_paid > 0 && $p->paid_at && $p->due_date)
            ->sortByDesc(fn (Payment $p) => $p->paid_at?->timestamp ?? 0);

        $streak = 0;
        foreach ($paid as $payment) {
            if ($payment->paid_at->lte($payment->due_date->copy()->endOfDay())) {
                $streak++;
            } else {
                break;
            }
        }

        return $streak;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  Collection<int, Loan>  $loans
     */
    private function defaultRiskLevel(int $score, array $metrics): string
    {
        if ($score < 40 || $metrics['missed_count'] >= 3) {
            return 'critical';
        }
        if ($score < 60 || $metrics['current_overdue_amount'] > 0) {
            return 'high';
        }
        if ($score < 75 || $metrics['delayed_rate'] > 15) {
            return 'medium';
        }

        return 'low';
    }

    private function improvementTrend(int $borrowerId, int $score, ?int $previousScore): string
    {
        if ($previousScore === null) {
            $hist = WellnessHistory::query()
                ->where('borrower_id', $borrowerId)
                ->orderByDesc('recorded_at')
                ->skip(1)
                ->first();
            $previousScore = $hist?->score;
        }

        if ($previousScore === null) {
            return 'stable';
        }
        if ($score > $previousScore + 2) {
            return 'improving';
        }
        if ($score < $previousScore - 2) {
            return 'declining';
        }

        return 'stable';
    }

    private function loanHealthStatus(int $overdueDays, int $missed, int $delayed, float $penalties, int $restructures): string
    {
        if ($overdueDays >= 90 || $missed >= 3) {
            return LoanHealthMetric::STATUS_DEFAULT_RISK;
        }
        if ($overdueDays >= 30 || $missed >= 2 || ($delayed >= 3 && $penalties > 1000)) {
            return LoanHealthMetric::STATUS_HIGH_RISK;
        }
        if ($overdueDays >= 7 || $delayed >= 2) {
            return LoanHealthMetric::STATUS_DELAYED;
        }
        if ($overdueDays > 0 || $restructures >= 1 || $penalties > 500) {
            return LoanHealthMetric::STATUS_WATCHLIST;
        }

        return LoanHealthMetric::STATUS_HEALTHY;
    }

    private function restructuringCount(Loan $loan): int
    {
        $payload = is_array($loan->application_payload) ? $loan->application_payload : [];
        $nature = strtolower((string) ($payload['application_nature'] ?? $payload['nature'] ?? ''));

        return str_contains($nature, 'restruct') ? 1 : 0;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  Collection<int, Loan>  $loans
     * @param  Collection<int, Payment>  $payments
     * @return list<array{code: string, label: string, severity: string}>
     */
    private function predictiveRiskFlags(array $metrics, Collection $loans, Collection $payments): array
    {
        $flags = [];

        if ($metrics['missed_count'] >= 2 || ($metrics['current_overdue_amount'] > 0 && $metrics['avg_delay_days'] >= 14)) {
            $flags[] = ['code' => 'possible_default', 'label' => 'Possible default risk', 'severity' => 'high'];
        }

        if ($metrics['delay_trend'] === 'worsening') {
            $flags[] = ['code' => 'increasing_delays', 'label' => 'Increasing delay pattern', 'severity' => 'medium'];
        }

        if ($metrics['active_loan_count'] >= 2 && $metrics['total_outstanding'] > 200000) {
            $flags[] = ['code' => 'high_debt_burden', 'label' => 'High active debt burden', 'severity' => 'medium'];
        }

        if ($metrics['repayment_rate'] < 80 && $metrics['evaluated'] >= 3) {
            $flags[] = ['code' => 'declining_consistency', 'label' => 'Declining payment consistency', 'severity' => 'medium'];
        }

        $recentOverdue = $payments->filter(fn (Payment $p) => $p->status === Payment::STATUS_OVERDUE)->count();
        if ($recentOverdue >= 2) {
            $flags[] = ['code' => 'multiple_overdue', 'label' => 'Multiple overdue installments', 'severity' => 'high'];
        }

        return $flags;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  list<array{code: string, label: string, severity: string}>  $riskFlags
     * @return list<array{type: string, message: string}>
     */
    private function buildRecommendations(array $metrics, int $score, string $category, array $riskFlags): array
    {
        $items = [];

        if ($metrics['payment_streak'] >= 3) {
            $items[] = ['type' => 'positive', 'message' => 'Excellent payment streak — keep it up!'];
        } elseif ($metrics['payment_streak'] < 3 && $score < 80) {
            $need = 3 - $metrics['payment_streak'];
            $items[] = ['type' => 'tip', 'message' => "Maintain {$need} more on-time payment(s) to improve your score."];
        }

        if ($metrics['delay_trend'] === 'worsening') {
            $items[] = ['type' => 'warning', 'message' => 'Your delayed payments have increased recently. Pay before due dates to avoid penalties.'];
        }

        if ($metrics['current_overdue_amount'] > 0) {
            $items[] = ['type' => 'urgent', 'message' => 'You have overdue balances. Pay now to protect your wellness score.'];
        }

        foreach ($riskFlags as $flag) {
            if ($flag['code'] === 'possible_default') {
                $items[] = ['type' => 'urgent', 'message' => 'Consider restructuring or contacting support to avoid penalties.'];
            }
        }

        if ($category === BorrowerCreditWellness::CATEGORY_EXCELLENT) {
            $items[] = ['type' => 'positive', 'message' => 'Strong financial wellness — you may qualify for faster approvals and better offers.'];
        }

        return array_slice($items, 0, 6);
    }

    private function recordHistory(int $borrowerId, int $score, string $category, BorrowerCreditWellness $wellness, bool $sufficientData = true): void
    {
        if (! $sufficientData || $category === 'insufficient') {
            return;
        }
        $last = WellnessHistory::query()
            ->where('borrower_id', $borrowerId)
            ->orderByDesc('recorded_at')
            ->first();

        $shouldRecord = ! $last
            || $last->score !== $score
            || ($last->recorded_at && $last->recorded_at->lt(now()->subHours(6)));

        if (! $shouldRecord) {
            return;
        }

        WellnessHistory::query()->create([
            'borrower_id' => $borrowerId,
            'score' => $score,
            'score_category' => $category,
            'snapshot' => [
                'repayment_rate' => $wellness->repayment_rate,
                'delayed_payment_count' => $wellness->delayed_payment_count,
                'missed_payment_count' => $wellness->missed_payment_count,
            ],
            'recorded_at' => now(),
        ]);
    }

    private function maybeNotifyBorrower(
        User $user,
        BorrowerCreditWellness $wellness,
        ?BorrowerCreditWellness $previous,
        ?int $previousScore,
    ): void {
        if ($previousScore !== null && $wellness->wellness_score > $previousScore) {
            $this->notificationCenter->notifyBorrower(
                $user,
                NotificationCenter::CATEGORY_CREDIT_WELLNESS,
                'wellness_improved',
                'Credit wellness improved',
                "Your wellness score increased to {$wellness->wellness_score} ({$wellness->score_category}).",
                ['wellness_score' => $wellness->wellness_score, 'score_category' => $wellness->score_category],
                ['dedupe_key' => "wellness:improved:{$user->id}:".now()->format('Y-m-d'), 'module' => NotificationCenter::MODULE_CREDIT_WELLNESS],
            );
        }

        if ($previous && $wellness->wellness_score < $previous->wellness_score - 3) {
            $this->notificationCenter->notifyBorrower(
                $user,
                NotificationCenter::CATEGORY_CREDIT_WELLNESS,
                'wellness_declined',
                'Credit wellness declined',
                'Your payment behavior has lowered your wellness score. Review recommendations in Credit & Wellness.',
                ['wellness_score' => $wellness->wellness_score],
                ['dedupe_key' => "wellness:declined:{$user->id}:".now()->format('Y-m-d'), 'module' => NotificationCenter::MODULE_CREDIT_WELLNESS],
            );
        }

        if ((float) $wellness->current_overdue_amount > 0) {
            $this->notificationCenter->notifyBorrower(
                $user,
                NotificationCenter::CATEGORY_PAYMENT_OVERDUE,
                'wellness_overdue',
                'Overdue balance affects wellness',
                'You have overdue amounts that may affect loan health and future approvals.',
                ['amount' => $wellness->current_overdue_amount],
                ['dedupe_key' => "wellness:overdue:{$user->id}:".now()->format('Y-m-d'), 'module' => NotificationCenter::MODULE_CREDIT_WELLNESS],
            );
        }
    }

    /**
     * Monthly average wellness scores from recorded history.
     *
     * @return list<array{date: string, score: float}>
     */
    private function portfolioScoreTrend(): array
    {
        $since = now()->subMonths(6)->startOfMonth();

        return WellnessHistory::query()
            ->where('recorded_at', '>=', $since)
            ->orderBy('recorded_at')
            ->get()
            ->groupBy(fn (WellnessHistory $h) => $h->recorded_at?->format('Y-m') ?? 'unknown')
            ->map(fn ($group, $month) => [
                'date' => $month,
                'score' => round($group->avg('score'), 1),
            ])
            ->values()
            ->all();
    }

  /**
     * @return array<string, mixed>
     */
    private function adminBorrowerRow(BorrowerCreditWellness $row): array
    {
        return [
            'borrower_id' => $row->borrower_id,
            'name' => $row->borrower?->name,
            'email' => $row->borrower?->email,
            'wellness_score' => $row->wellness_score,
            'score_category' => $row->score_category,
            'credit_score' => $row->borrower?->credit_score,
            'default_risk_level' => $row->default_risk_level,
            'improvement_trend' => $row->improvement_trend,
            'repayment_rate' => (float) $row->repayment_rate,
        ];
    }
}
