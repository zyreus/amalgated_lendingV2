<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\PaymentReceiptAudit;
use App\Services\ActivityLogger;
use App\Services\ReportSummaryService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportController extends Controller
{
    public function summary(Request $request, ReportSummaryService $reportSummary): JsonResponse
    {
        $period = $reportSummary->resolveSummaryPeriod($request, false);
        $summary = $reportSummary->summarize($period['from'], $period['to']);

        return response()->json([
            'ok' => true,
            'period' => [
                'from' => $period['from']->toIso8601String(),
                'to' => $period['to']->toIso8601String(),
            ],
            'summary' => $summary,
        ]);
    }

    /**
     * Records a print action for compliance (same permission as viewing reports).
     * Client calls this before opening the browser print dialog.
     */
    public function logPrint(Request $request, ReportSummaryService $reportSummary, ActivityLogger $logger): JsonResponse
    {
        $period = $reportSummary->resolveSummaryPeriod($request, true);
        $summary = $reportSummary->summarize($period['from'], $period['to']);

        $logger->log($request->user(), 'reports.print_summary', null, [
            'from' => $period['from']->toIso8601String(),
            'to' => $period['to']->toIso8601String(),
            'summary' => $summary,
        ]);

        return response()->json(['ok' => true]);
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

        $paidBase = Payment::query()
            ->where('status', Payment::STATUS_PAID)
            ->whereBetween('paid_at', [$from, $to]);

        $orOnly = (clone $paidBase)->where(function ($q): void {
            $q->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                ->where(function ($x): void {
                    $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                });
        })->count();

        $arOnly = (clone $paidBase)->where(function ($q): void {
            $q->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '')
                ->where(function ($x): void {
                    $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                });
        })->count();

        $orAndAr = (clone $paidBase)->where(function ($q): void {
            $q->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                ->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '');
        })->count();

        $duplicateAttempts = (int) DB::table('payment_receipt_audits')
            ->where('action', PaymentReceiptAudit::ACTION_DUPLICATE_ATTEMPT)
            ->whereBetween('created_at', [$from, $to])
            ->count();

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
            'paid_or_only_count' => $orOnly,
            'paid_ar_only_count' => $arOnly,
            'paid_or_and_ar_count' => $orAndAr,
            'duplicate_receipt_attempts' => $duplicateAttempts,
            'missing_receipt_numbers_count' => $missingReceipts,
            'by_day' => $byDay,
            'by_recorded_by' => $byCollector,
        ]);
    }
}
