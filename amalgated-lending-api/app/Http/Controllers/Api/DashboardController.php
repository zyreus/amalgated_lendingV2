<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\Payment;
use App\Models\TravelAssistanceDetail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
        $payload = Cache::remember('admin.dashboard.summary_v1', 15, fn () => $this->buildSummaryPayload());

        return response()
            ->json(['ok' => true, 'summary' => $payload])
            ->header('Cache-Control', 'private, max-age=15, must-revalidate');
    }

    public function charts(): JsonResponse
    {
        $cacheKey = 'admin.dashboard.charts_v1:'.now()->format('Y-m');
        $body = Cache::remember($cacheKey, 120, fn () => $this->buildChartsPayload());

        return response()
            ->json([
                'ok' => true,
                'loan_growth' => $body['loan_growth'],
                'repayments' => $body['repayments'],
                'revenue_trend' => $body['revenue_trend'],
            ])
            ->header('Cache-Control', 'private, max-age=60, must-revalidate');
    }

    /**
     * Single round-trip for admin dashboard home: summary + chart series.
     * Uses the same cache keys as {@see summary()} and {@see charts()} so warm caches stay coherent.
     */
    public function overview(): JsonResponse
    {
        $summary = Cache::remember('admin.dashboard.summary_v1', 15, fn () => $this->buildSummaryPayload());
        $chartsKey = 'admin.dashboard.charts_v1:'.now()->format('Y-m');
        $charts = Cache::remember($chartsKey, 120, fn () => $this->buildChartsPayload());

        return response()
            ->json([
                'ok' => true,
                'summary' => $summary,
                'loan_growth' => $charts['loan_growth'],
                'repayments' => $charts['repayments'],
                'revenue_trend' => $charts['revenue_trend'],
            ])
            ->header('Cache-Control', 'private, max-age=15, must-revalidate');
    }

    /**
     * @return array<string, mixed>
     */
    private function buildSummaryPayload(): array
    {
        $totalUsers = (int) User::query()->count();

        $o = Loan::STATUS_ONGOING;
        $p = Loan::STATUS_PENDING;
        $r = Loan::STATUS_REJECTED;
        $c = Loan::STATUS_COMPLETED;

        $loanAgg = Loan::query()
            ->selectRaw(
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active_loans, '.
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as pending_applications, '.
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as rejected_loans, '.
                'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as completed_loans, '.
                'COALESCE(SUM(CASE WHEN status IN (?, ?) THEN principal ELSE 0 END), 0) as total_principal_released',
                [$o, $p, $r, $c, $o, $c]
            )
            ->first();

        $totalPrincipalReleased = (float) ($loanAgg->total_principal_released ?? 0);
        $totalRevenue = (float) Payment::query()->sum('amount_paid');

        $overdueLoans = (int) Loan::query()
            ->where('loans.status', Loan::STATUS_ONGOING)
            ->whereExists(function ($q) {
                $q->selectRaw('1')
                    ->from('payments')
                    ->whereColumn('payments.loan_id', 'loans.id')
                    ->where('payments.status', '!=', Payment::STATUS_PAID)
                    ->whereDate('payments.due_date', '<', now()->toDateString());
            })
            ->count();

        return [
            'total_users' => $totalUsers,
            'active_loans' => (int) ($loanAgg->active_loans ?? 0),
            'pending_applications' => (int) ($loanAgg->pending_applications ?? 0),
            'rejected_loans' => (int) ($loanAgg->rejected_loans ?? 0),
            'completed_loans' => (int) ($loanAgg->completed_loans ?? 0),
            'total_principal_released' => round($totalPrincipalReleased, 2),
            'total_revenue' => round($totalRevenue, 2),
            'overdue_loans' => $overdueLoans,
            'travel_assistance' => $this->travelAssistanceAnalytics(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function travelAssistanceAnalytics(): array
    {
        $base = LoanApplication::query()->where('loan_type', LoanApplication::TYPE_TRAVEL_ASSISTANCE);
        $total = (clone $base)->count();
        $approved = (clone $base)->whereIn('status', [LoanApplication::STATUS_APPROVED, LoanApplication::STATUS_PRE_APPROVED])->count();
        $releasedLoanIds = (clone $base)->whereNotNull('loan_id')->pluck('loan_id');

        return [
            'total_applications' => $total,
            'by_destination_country' => TravelAssistanceDetail::query()
                ->select('destination_country', DB::raw('COUNT(*) as count'))
                ->whereNotNull('destination_country')
                ->groupBy('destination_country')
                ->orderByDesc('count')
                ->limit(10)
                ->get(),
            'ofw_applications' => TravelAssistanceDetail::query()->where('travel_purpose', 'OFW Deployment')->count(),
            'tourist_applications' => TravelAssistanceDetail::query()->where('travel_purpose', 'Tourist Travel')->count(),
            'approval_rate' => $total > 0 ? round(($approved / $total) * 100, 2) : 0.0,
            'released_loan_amount' => round((float) Loan::query()->whereIn('id', $releasedLoanIds)->sum('principal'), 2),
            'travel_loan_revenue' => round((float) Payment::query()->whereIn('loan_id', $releasedLoanIds)->sum('amount_paid'), 2),
        ];
    }

    /**
     * @return array{loan_growth: array<int, array<string, mixed>>, repayments: array<int, array<string, mixed>>, revenue_trend: array<int, array<string, mixed>>}
     */
    private function buildChartsPayload(): array
    {
        $startPeriod = now()->subMonths(5)->startOfMonth();
        $endPeriod = now()->endOfMonth();
        $months = collect(range(5, 0))->map(fn (int $i) => now()->subMonths($i)->format('Y-m'))->values();

        $loanCounts = Loan::query()
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') as month_key")
            ->selectRaw('COUNT(*) as aggregate_count')
            ->whereBetween('created_at', [$startPeriod, $endPeriod])
            ->groupBy('month_key')
            ->pluck('aggregate_count', 'month_key');

        $repaymentSums = Payment::query()
            ->selectRaw("DATE_FORMAT(paid_at, '%Y-%m') as month_key")
            ->selectRaw('COALESCE(SUM(amount_paid), 0) as aggregate_amount')
            ->whereNotNull('paid_at')
            ->whereBetween('paid_at', [$startPeriod, $endPeriod])
            ->groupBy('month_key')
            ->pluck('aggregate_amount', 'month_key');

        $loanGrowth = $months->map(fn (string $month) => [
            'month' => $month,
            'count' => (int) ($loanCounts[$month] ?? 0),
        ])->values()->all();

        $repayments = $months->map(fn (string $month) => [
            'month' => $month,
            'amount' => round((float) ($repaymentSums[$month] ?? 0), 2),
        ])->values()->all();

        $revenueByMonth = $months->map(fn (string $month) => [
            'month' => $month,
            'revenue' => round((float) ($repaymentSums[$month] ?? 0), 2),
        ])->values()->all();

        return [
            'loan_growth' => $loanGrowth,
            'repayments' => $repayments,
            'revenue_trend' => $revenueByMonth,
        ];
    }
}
