<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
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

        return response()->json([
            'ok' => true,
            'summary' => [
                'total_users' => $totalUsers,
                'active_loans' => (int) ($loanAgg->active_loans ?? 0),
                'pending_applications' => (int) ($loanAgg->pending_applications ?? 0),
                'rejected_loans' => (int) ($loanAgg->rejected_loans ?? 0),
                'completed_loans' => (int) ($loanAgg->completed_loans ?? 0),
                'total_principal_released' => round($totalPrincipalReleased, 2),
                'total_revenue' => round($totalRevenue, 2),
                'overdue_loans' => $overdueLoans,
            ],
        ]);
    }

    public function charts(): JsonResponse
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
        ])->values();

        $repayments = $months->map(fn (string $month) => [
            'month' => $month,
            'amount' => round((float) ($repaymentSums[$month] ?? 0), 2),
        ])->values();

        $revenueByMonth = $months->map(fn (string $month) => [
            'month' => $month,
            'revenue' => round((float) ($repaymentSums[$month] ?? 0), 2),
        ])->values();

        return response()->json([
            'ok' => true,
            'loan_growth' => $loanGrowth,
            'repayments' => $repayments,
            'revenue_trend' => $revenueByMonth,
        ]);
    }
}
