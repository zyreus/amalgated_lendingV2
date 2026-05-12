<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Payment;
use Carbon\Carbon;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Illuminate\Validation\ValidationException;

/**
 * Financial summary metrics and export payloads for the admin Reports module.
 */
class ReportSummaryService
{
    /** Inclusive maximum span for summary / exports (abuse prevention). */
    public const MAX_RANGE_DAYS = 2190;

    /**
     * @return array{from: Carbon, to: Carbon}
     *
     * @throws ValidationException
     */
    public function resolveSummaryPeriod(Request $request, bool $requireExplicitDates): array
    {
        if ($requireExplicitDates && (! $request->filled('from') || ! $request->filled('to'))) {
            throw ValidationException::withMessages([
                'from' => ['The from and to dates are required for export.'],
                'to' => ['The from and to dates are required for export.'],
            ]);
        }

        $from = $request->filled('from')
            ? Carbon::parse((string) $request->query('from'))->startOfDay()
            : now()->subMonths(3)->startOfDay();
        $to = $request->filled('to')
            ? Carbon::parse((string) $request->query('to'))->endOfDay()
            : now()->endOfDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must be before or equal to the to date.'],
            ]);
        }

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages([
                'to' => ['The selected date range is too large for one export. Please choose a shorter period.'],
            ]);
        }

        return ['from' => $from, 'to' => $to];
    }

    /**
     * @return array{applications_submitted: int, loans_disbursed: int, principal_disbursed: float, collections: float}
     */
    public function summarize(Carbon $from, Carbon $to): array
    {
        $applications = Loan::query()->whereBetween('created_at', [$from, $to]);

        $disbursed = Loan::query()
            ->whereBetween('disbursed_at', [$from, $to])
            ->whereIn('status', [Loan::STATUS_ONGOING, Loan::STATUS_COMPLETED]);

        $collections = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->whereNotNull('paid_at');

        return [
            'applications_submitted' => (clone $applications)->count(),
            'loans_disbursed' => (clone $disbursed)->count(),
            'principal_disbursed' => round((float) (clone $disbursed)->sum('principal'), 2),
            'collections' => round((float) $collections->sum('amount_paid'), 2),
        ];
    }

    /**
     * UTF-8 CSV with BOM for Excel; includes title, period, export timestamp, and metric rows.
     */
    public function buildFinancialSummaryCsv(Carbon $from, Carbon $to, array $summary): string
    {
        $company = (string) config('app.name', 'Amalgated Lending');
        $exportedAt = now()->timezone(config('app.timezone'))->format('Y-m-d H:i:s T');
        $periodFrom = $from->format('F j, Y');
        $periodTo = $to->format('F j, Y');

        $principal = $this->formatPesoCsv($summary['principal_disbursed'] ?? 0);
        $collections = $this->formatPesoCsv($summary['collections'] ?? 0);

        $rows = [
            [$company.' — Financial Summary Report'],
            [],
            ['Report title', 'Financial summary'],
            ['Period covered (from)', $periodFrom],
            ['Period covered (to)', $periodTo],
            ['Export date', $exportedAt],
            [],
            ['Metric', 'Value'],
            ['Applications submitted', (string) (int) ($summary['applications_submitted'] ?? 0)],
            ['Loans disbursed', (string) (int) ($summary['loans_disbursed'] ?? 0)],
            ['Principal disbursed (PHP)', $principal],
            ['Total collections (PHP)', $collections],
        ];

        $lines = array_map(fn (array $r) => implode(',', array_map(fn ($c) => $this->escapeCsvField($c), $r)), $rows);

        return "\xEF\xBB\xBF".implode("\r\n", $lines)."\r\n";
    }

    public function renderFinancialSummaryPdf(Carbon $from, Carbon $to, array $summary): string
    {
        $appName = (string) config('app.name', 'Amalgated Lending');
        $logoPath = public_path('images/company-logo.png');
        $logoUrl = is_string($logoPath) && is_file($logoPath)
            ? 'file://'.str_replace('\\', '/', $logoPath)
            : null;

        $html = View::make('pdf.reports.financial-summary', [
            'appName' => $appName,
            'logoUrl' => $logoUrl,
            'periodFrom' => $from->format('F j, Y'),
            'periodTo' => $to->format('F j, Y'),
            'exportedAt' => now()->timezone(config('app.timezone'))->format('F j, Y \a\t g:i A T'),
            'summary' => $summary,
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [public_path()]);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'landscape');
        $dompdf->render();

        $canvas = $dompdf->getCanvas();
        $w = $canvas->get_width();
        $canvas->page_script(function ($pageNumber, $pageCount, $canvas, $fontMetrics) use ($w): void {
            $font = $fontMetrics->get_font('DejaVu Sans', 'normal');
            $size = 8;
            $text = 'Page '.$pageNumber.' of '.$pageCount;
            $tw = $fontMetrics->getTextWidth($text, $font, $size);
            $canvas->text($w - $tw - 36, $canvas->get_height() - 28, $text, $font, $size, [0.25, 0.25, 0.25]);
        });

        return $dompdf->output();
    }

    private function formatPesoCsv(float|int|string $amount): string
    {
        $n = round((float) $amount, 2);

        return 'PHP '.number_format($n, 2, '.', ',');
    }

    private function escapeCsvField(mixed $value): string
    {
        if ($value === null) {
            return '';
        }
        $s = (string) $value;
        if (str_contains($s, '"') || str_contains($s, ',') || str_contains($s, "\n") || str_contains($s, "\r")) {
            return '"'.str_replace('"', '""', $s).'"';
        }

        return $s;
    }
}
