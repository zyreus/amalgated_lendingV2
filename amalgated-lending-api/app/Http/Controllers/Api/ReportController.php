<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Services\ActivityLogger;
use App\Services\ReportSummaryService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

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

    public function exportSummaryCsv(Request $request, ReportSummaryService $reportSummary, ActivityLogger $logger): Response
    {
        $period = $reportSummary->resolveSummaryPeriod($request, true);
        $summary = $reportSummary->summarize($period['from'], $period['to']);
        $csv = $reportSummary->buildFinancialSummaryCsv($period['from'], $period['to'], $summary);

        $logger->log($request->user(), 'reports.export_summary_csv', null, [
            'from' => $period['from']->toIso8601String(),
            'to' => $period['to']->toIso8601String(),
        ]);

        $filename = 'financial-summary_'.$period['from']->format('Y-m-d').'_'.$period['to']->format('Y-m-d').'.csv';

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    /**
     * @return Response|JsonResponse
     */
    public function exportSummaryPdf(Request $request, ReportSummaryService $reportSummary, ActivityLogger $logger)
    {
        $period = $reportSummary->resolveSummaryPeriod($request, true);
        $summary = $reportSummary->summarize($period['from'], $period['to']);

        try {
            $binary = $reportSummary->renderFinancialSummaryPdf($period['from'], $period['to'], $summary);
        } catch (Throwable $e) {
            Log::error('reports.export_summary_pdf_failed', [
                'message' => $e->getMessage(),
                'exception' => $e::class,
            ]);

            return response()->json([
                'ok' => false,
                'message' => 'Could not generate the PDF report. Please try again later.',
            ], 500);
        }

        $logger->log($request->user(), 'reports.export_summary_pdf', null, [
            'from' => $period['from']->toIso8601String(),
            'to' => $period['to']->toIso8601String(),
        ]);

        $filename = 'financial-summary_'.$period['from']->format('Y-m-d').'_'.$period['to']->format('Y-m-d').'.pdf';

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-store, private',
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
