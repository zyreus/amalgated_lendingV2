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
        $totalUsers = User::count();

        $activeLoans = Loan::where('status', Loan::STATUS_ONGOING)->count();
        $pendingApplications = Loan::where('status', Loan::STATUS_PENDING)->count();
        $rejectedLoans = Loan::where('status', Loan::STATUS_REJECTED)->count();
        $completedLoans = Loan::where('status', Loan::STATUS_COMPLETED)->count();

        $totalPrincipalReleased = (float) Loan::query()
            ->whereIn('status', [Loan::STATUS_ONGOING, Loan::STATUS_COMPLETED])
            ->sum('principal');

        $totalRevenue = (float) Payment::sum('amount_paid');

        $overdueLoans = Loan::query()
            ->whereIn('status', [Loan::STATUS_ONGOING])
            ->whereHas('payments', function ($q) {
                $q->where('status', '!=', Payment::STATUS_PAID)
                    ->whereDate('due_date', '<', now()->toDateString());
            })
            ->count();

        return response()->json([
            'ok' => true,
            'summary' => [
                'total_users' => $totalUsers,
                'active_loans' => $activeLoans,
                'pending_applications' => $pendingApplications,
                'rejected_loans' => $rejectedLoans,
                'completed_loans' => $completedLoans,
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
