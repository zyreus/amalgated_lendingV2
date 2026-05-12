<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $from = $request->query('from')
            ? Carbon::parse($request->query('from'))->startOfDay()
            : now()->subMonths(3)->startOfDay();
        $to = $request->query('to')
            ? Carbon::parse($request->query('to'))->endOfDay()
            : now()->endOfDay();

        $applications = Loan::query()->whereBetween('created_at', [$from, $to]);

        $disbursed = Loan::query()
            ->whereBetween('disbursed_at', [$from, $to])
            ->whereIn('status', [Loan::STATUS_ONGOING, Loan::STATUS_COMPLETED]);

        $collections = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->whereNotNull('paid_at');

        return response()->json([
            'ok' => true,
            'period' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'summary' => [
                'applications_submitted' => (clone $applications)->count(),
                'loans_disbursed' => (clone $disbursed)->count(),
                'principal_disbursed' => round((float) (clone $disbursed)->sum('principal'), 2),
                'collections' => round((float) $collections->sum('amount_paid'), 2),
            ],
        ]);
    }

    /**
     * Payment / receipt analytics for collections dashboards (OR/AR compliance, collector throughput).
     */
    public function paymentLedger(Request $request): JsonResponse
    {
        $from = $request->query('from')
            ? Carbon::parse($request->query('from'))->startOfDay()
            : now()->subDays(30)->startOfDay();
        $to = $request->query('to')
            ? Carbon::parse($request->query('to'))->endOfDay()
            : now()->endOfDay();

        $paid = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);

        $missingReceipts = (clone $paid)->where(function ($q): void {
            $q->where(function ($x): void {
                $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
            })->where(function ($x): void {
                $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
            });
        })->count();

        $byDay = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to])
            ->selectRaw('DATE(paid_at) as d, COUNT(*) as c, COALESCE(SUM(amount_paid),0) as total')
            ->groupBy(DB::raw('DATE(paid_at)'))
            ->orderBy('d')
            ->get();

        $byCollector = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to])
            ->whereNotNull('recorded_by')
            ->selectRaw('recorded_by, COUNT(*) as c, COALESCE(SUM(amount_paid),0) as total')
            ->groupBy('recorded_by')
            ->with('recordedByUser:id,name')
            ->orderByDesc('total')
            ->limit(25)
            ->get();

        return response()->json([
            'ok' => true,
            'period' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
            ],
            'paid_installments_count' => (clone $paid)->count(),
            'paid_amount_total' => round((float) (clone $paid)->sum('amount_paid'), 2),
            'missing_receipt_numbers_count' => $missingReceipts,
            'by_day' => $byDay,
            'by_recorded_by' => $byCollector,
        ]);
    }
}
