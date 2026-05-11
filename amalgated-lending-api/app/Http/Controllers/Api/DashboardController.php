<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
        $payload = Cache::remember('admin.dashboard.summary_v1', 15, function () {
            $totalUsers = (int) User::query()->count();

            $o = Loan::STATUS_ONGOING;
            $p = Loan::STATUS_PENDING;
            $r = Loan::STATUS_REJECTED;
            $c = Loan::STATUS_COMPLETED;

            /** One round-trip for status counts + released principal (was five separate aggregates). */
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

            $overdueLoans = Loan::query()
                ->where('status', Loan::STATUS_ONGOING)
                ->whereHas('payments', function ($q) {
                    $q->where('status', '!=', Payment::STATUS_PAID)
                        ->whereDate('due_date', '<', now()->toDateString());
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
            ];
        });

        return response()
            ->json(['ok' => true, 'summary' => $payload])
            /**
             * 15 s aligns with the server-side `Cache::remember` TTL above, so the SPA can
             * reuse this response from the disk cache without a network call. `must-revalidate`
             * forces a refresh once the TTL expires (no stale data).
             */
            ->header('Cache-Control', 'private, max-age=15, must-revalidate');
    }

    public function charts(): JsonResponse
    {
        $cacheKey = 'admin.dashboard.charts_v1:'.now()->format('Y-m');
        $body = Cache::remember($cacheKey, 120, function () {
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
        });

        return response()
            ->json([
                'ok' => true,
                'loan_growth' => $body['loan_growth'],
                'repayments' => $body['repayments'],
                'revenue_trend' => $body['revenue_trend'],
            ])
            /** 120 s aligns with the server-side `Cache::remember` TTL — chart data shifts slowly. */
            ->header('Cache-Control', 'private, max-age=60, must-revalidate');
    }
}
