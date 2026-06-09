<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendSoaStatementEmailJob;
use App\Models\Loan;
use App\Models\SoaLog;
use App\Models\SoaStatement;
use App\Repositories\SOARepository;
use App\Services\ActivityLogger;
use App\Services\AnalyticsService;
use App\Services\PDFGenerationService;
use App\Services\SOAService;
use App\Support\PdfSupport;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SOAController extends Controller
{
    public function __construct(
        private readonly SOARepository $statements,
        private readonly SOAService $soa,
        private readonly PDFGenerationService $pdfs,
        private readonly AnalyticsService $analytics,
    ) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['ok' => true, 'data' => $this->statements->filtered($request)]);
    }

    public function show(SoaStatement $statement): JsonResponse
    {
        $statement->loadMissing(['borrower:id,name,email,phone,credit_score,risk_level', 'loan.payments', 'logs.creator:id,name']);

        return response()->json(['ok' => true, 'data' => $this->serialize($statement, true)]);
    }

    public function generate(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'borrower_id' => 'nullable|integer|exists:users,id',
            'loan_id' => 'required|integer|exists:loans,id',
            'statement_month' => 'nullable|date',
            'send_email' => 'nullable|boolean',
        ]);

        $loan = Loan::query()->with(['borrower', 'payments'])->findOrFail((int) $data['loan_id']);
        if (isset($data['borrower_id']) && (int) $loan->borrower_id !== (int) $data['borrower_id']) {
            return response()->json(['ok' => false, 'message' => 'Selected loan does not belong to the selected borrower.'], 422);
        }

        $statement = $this->soa->generateForLoan($loan, $data['statement_month'] ?? null, $request->user()?->id, (bool) ($data['send_email'] ?? true));
        $logger->log($request->user(), 'soa.generate', $statement);

        return response()->json(['ok' => true, 'data' => $this->serialize($statement->fresh(['borrower', 'loan']), false)]);
    }

    public function batch(Request $request, ActivityLogger $logger): JsonResponse
    {
        $data = $request->validate([
            'borrower_id' => 'nullable|integer|exists:users,id',
            'borrower_name' => 'nullable|string|max:255',
            'statement_month' => 'nullable|date',
            'send_email' => 'nullable|boolean',
        ]);

        $result = $this->soa->generateBatch(
            isset($data['borrower_id']) ? (int) $data['borrower_id'] : null,
            $data['statement_month'] ?? null,
            $request->user()?->id,
            (bool) ($data['send_email'] ?? true),
            $data['borrower_name'] ?? null
        );

        $logger->log($request->user(), 'soa.batch_generate', null, $result, 'soa_statements');

        return response()->json(['ok' => true, 'data' => $result]);
    }

    public function preview(SoaStatement $statement): JsonResponse
    {
        $statement->loadMissing(['borrower', 'loan.payments']);

        return response()->json(['ok' => true, 'data' => $this->serialize($statement, true)]);
    }

    public function previewPdf(SoaStatement $statement): Response|JsonResponse
    {
        try {
            $path = $this->pdfs->ensureSoaPdf($statement);
        } catch (\Throwable $e) {
            if (stripos($e->getMessage(), 'GD') !== false) {
                return response()->json([
                    'ok' => false,
                    'message' => 'PDF generation requires the PHP GD extension.',
                    'hint' => PdfSupport::gdInstallHint(),
                ], 503);
            }

            throw $e;
        }

        return response(Storage::disk('public')->get($path), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="SOA-'.$statement->statement_month?->format('Y-m').'-'.$statement->id.'.pdf"',
        ]);
    }

    public function download(Request $request, SoaStatement $statement, ActivityLogger $logger): Response|JsonResponse
    {
        try {
            $path = $this->pdfs->ensureSoaPdf($statement);
        } catch (\Throwable $e) {
            if (stripos($e->getMessage(), 'GD') !== false) {
                return response()->json([
                    'ok' => false,
                    'message' => 'PDF generation requires the PHP GD extension.',
                    'hint' => PdfSupport::gdInstallHint(),
                ], 503);
            }

            throw $e;
        }

        SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'admin_downloaded', 'description' => 'Admin downloaded statement PDF.', 'created_by' => $request->user()?->id]);
        $logger->log($request->user(), 'soa.download', $statement);

        return response(Storage::disk('public')->get($path), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="SOA-'.$statement->statement_month?->format('Y-m').'-'.$statement->id.'.pdf"',
        ]);
    }

    public function resend(Request $request, SoaStatement $statement, ActivityLogger $logger): JsonResponse
    {
        SendSoaStatementEmailJob::dispatch($statement->id, $request->user()?->id);
        SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'email_queued', 'description' => 'Admin queued SOA email resend.', 'created_by' => $request->user()?->id]);
        $logger->log($request->user(), 'soa.resend_email', $statement);

        return response()->json(['ok' => true, 'message' => 'SOA email queued.']);
    }

    public function analytics(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => $this->analytics->soaDashboardForRequest($request),
        ]);
    }

    public function eligibleLoans(Request $request): JsonResponse
    {
        $term = trim((string) $request->query('q', ''));
        $borrowerId = (int) $request->query('borrower_id', 0);
        $limit = min(100, max(10, (int) $request->query('limit', 50)));

        $loans = Loan::query()
            ->with('borrower:id,name,email,phone')
            ->whereIn('status', [Loan::STATUS_APPROVED, Loan::STATUS_ONGOING])
            ->when($borrowerId > 0, fn ($query) => $query->where('borrower_id', $borrowerId))
            ->when($term !== '', function ($query) use ($term): void {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $loanId = preg_replace('/\D+/', '', $term);

                $query->where(function ($nested) use ($like, $loanId): void {
                    $nested->whereHas('borrower', fn ($borrower) => $borrower
                        ->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like)
                    );

                    if ($loanId !== '') {
                        $nested->orWhere('id', (int) $loanId);
                    }
                });
            })
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (Loan $loan) => [
                'id' => $loan->id,
                'loan_number' => $loan->loan_number,
                'principal' => (float) $loan->principal,
                'status' => $loan->status,
                'borrower' => $loan->borrower ? [
                    'id' => $loan->borrower->id,
                    'name' => $loan->borrower->name,
                    'email' => $loan->borrower->email,
                    'phone' => $loan->borrower->phone,
                ] : null,
            ])
            ->values();

        return response()->json(['ok' => true, 'data' => $loans]);
    }

    public function export(Request $request): StreamedResponse|Response|JsonResponse
    {
        $format = strtolower((string) $request->query('format', 'csv'));
        abort_unless(in_array($format, ['csv', 'excel', 'pdf'], true), 422, 'Unsupported export format.');

        $rows = $this->statements->queryForFilters($request)
            ->orderByDesc('statement_month')
            ->orderByDesc('id')
            ->get();

        if ($format === 'pdf') {
            try {
                $dompdf = new Dompdf(PdfSupport::dompdfOptions());
                $dompdf->loadHtml($this->exportPdfHtml($rows), 'UTF-8');
                $dompdf->setPaper('A4', 'landscape');
                $dompdf->render();

                return response($dompdf->output(), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'attachment; filename="soa-report-'.now()->format('Ymd-His').'.pdf"',
                ]);
            } catch (\Throwable $e) {
                if (stripos($e->getMessage(), 'GD') !== false) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'PDF export requires the PHP GD extension.',
                        'hint' => PdfSupport::gdInstallHint(),
                    ], 503);
                }

                throw $e;
            }
        }

        $filename = 'soa-report-'.now()->format('Ymd-His').($format === 'excel' ? '.xls' : '.csv');

        return response()->streamDownload(function () use ($rows): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['SOA ID', 'Borrower', 'Email', 'Loan ID', 'Month', 'Due Date', 'Monthly Due', 'Penalties', 'Remaining Balance', 'Total Due', 'Status', 'Email Sent', 'Viewed', 'Downloaded']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row->id,
                    $row->borrower?->name,
                    $row->borrower?->email,
                    $row->loan_id,
                    $row->statement_month?->toDateString(),
                    $row->due_date?->toDateString(),
                    $row->monthly_due,
                    $row->penalties,
                    $row->remaining_balance,
                    $row->total_due,
                    $row->status,
                    $row->email_sent ? 'yes' : 'no',
                    $row->viewed_at?->toIso8601String(),
                    $row->downloaded_at?->toIso8601String(),
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => $format === 'excel' ? 'application/vnd.ms-excel' : 'text/csv']);
    }

    private function serialize(SoaStatement $statement, bool $detail): array
    {
        return [
            'id' => $statement->id,
            'statement_number' => $statement->statement_number,
            'borrower' => $statement->borrower ? ['id' => $statement->borrower->id, 'name' => $statement->borrower->name, 'email' => $statement->borrower->email] : null,
            'loan_id' => $statement->loan_id,
            'loan_number' => $statement->loan?->loan_number,
            'statement_month' => $statement->statement_month?->toDateString(),
            'statement_month_label' => $statement->statement_month?->format('F Y'),
            'due_date' => $statement->due_date?->toDateString(),
            'monthly_due' => (float) $statement->monthly_due,
            'penalties' => (float) $statement->penalties,
            'remaining_balance' => (float) $statement->remaining_balance,
            'total_due' => (float) $statement->total_due,
            'status' => $statement->status,
            'email_sent' => (bool) $statement->email_sent,
            'email_sent_at' => $statement->email_sent_at?->toIso8601String(),
            'viewed_at' => $statement->viewed_at?->toIso8601String(),
            'downloaded_at' => $statement->downloaded_at?->toIso8601String(),
            'download_url' => '/api/v1/soa/'.$statement->id.'/download',
            'snapshot' => $detail ? $statement->snapshot : null,
            'logs' => $detail ? $statement->logs?->map(fn (SoaLog $log) => ['action' => $log->action, 'description' => $log->description, 'created_at' => $log->created_at?->toIso8601String(), 'created_by' => $log->creator?->name])->values() : null,
        ];
    }

    private function exportPdfHtml($rows): string
    {
        $html = '<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:DejaVu Sans,sans-serif;font-size:10px;color:#111827}h1{font-size:18px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #e5e7eb;padding:6px;text-align:left}th{background:#f9fafb;color:#6b7280;text-transform:uppercase;font-size:8px}.amount{font-weight:bold;color:#991b1b}</style></head><body>';
        $html .= '<h1>SOA Financial Report</h1><p>Generated '.e(now()->format('F j, Y g:i A')).'</p><table><thead><tr><th>SOA</th><th>Borrower</th><th>Loan</th><th>Month</th><th>Due Date</th><th>Total Due</th><th>Balance</th><th>Status</th></tr></thead><tbody>';
        foreach ($rows as $row) {
            $html .= '<tr><td>'.e($row->statement_number).'</td><td>'.e((string) $row->borrower?->name).'</td><td>'.e('LN-'.str_pad((string) $row->loan_id, 6, '0', STR_PAD_LEFT)).'</td><td>'.e((string) $row->statement_month?->format('Y-m')).'</td><td>'.e((string) $row->due_date?->toDateString()).'</td><td class="amount">PHP '.e(number_format((float) $row->total_due, 2)).'</td><td>PHP '.e(number_format((float) $row->remaining_balance, 2)).'</td><td>'.e((string) $row->status).'</td></tr>';
        }
        $html .= '</tbody></table></body></html>';

        return $html;
    }
}
