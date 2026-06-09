<?php

namespace App\Services;

use App\Models\EmailLog;
use App\Models\Payment;
use App\Models\SoaStatement;
use App\Support\PdfSupport;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AnalyticsService
{
    public function soaDashboard(Carbon|string|null $from = null, Carbon|string|null $to = null): array
    {
        $start = $from ? Carbon::parse($from)->startOfDay() : now()->subMonths(6)->startOfMonth();
        $end = $to ? Carbon::parse($to)->endOfDay() : now()->endOfDay();
        $cacheKey = 'soa_analytics:'.$start->toDateString().':'.$end->toDateString();

        $payload = Cache::remember($cacheKey, now()->addMinutes(10), function () use ($start, $end): array {
            $base = SoaStatement::query()->whereBetween('statement_month', [$start->toDateString(), $end->toDateString()]);
            $paidPayments = Payment::query()->where('status', Payment::STATUS_PAID)->whereBetween('paid_at', [$start, $end]);

            return [
                'summary' => [
                    'total_generated' => (clone $base)->count(),
                    'total_due' => round((float) (clone $base)->sum('total_due'), 2),
                    'outstanding_balance' => round((float) (clone $base)->sum('remaining_balance'), 2),
                    'penalties' => round((float) (clone $base)->sum('penalties'), 2),
                    'email_sent' => (clone $base)->where('email_sent', true)->count(),
                    'viewed' => (clone $base)->whereNotNull('viewed_at')->count(),
                    'downloaded' => (clone $base)->whereNotNull('downloaded_at')->count(),
                    'paid_collections' => round((float) (clone $paidPayments)->sum('amount_paid'), 2),
                    'overdue_accounts' => (clone $base)->where('due_date', '<', now()->toDateString())->whereNotIn('status', [SoaStatement::STATUS_PAID])->count(),
                ],
                'monthly_trends' => SoaStatement::query()
                    ->whereBetween('statement_month', [$start->toDateString(), $end->toDateString()])
                    ->selectRaw("DATE_FORMAT(statement_month, '%Y-%m') as month, COUNT(*) as generated_count, COALESCE(SUM(total_due),0) as projected, COALESCE(SUM(remaining_balance),0) as outstanding, COALESCE(SUM(penalties),0) as penalties")
                    ->groupBy(DB::raw("DATE_FORMAT(statement_month, '%Y-%m')"))
                    ->orderBy('month')
                    ->get(),
                'status_breakdown' => SoaStatement::query()
                    ->whereBetween('statement_month', [$start->toDateString(), $end->toDateString()])
                    ->selectRaw('status, COUNT(*) as count, COALESCE(SUM(total_due),0) as total_due')
                    ->groupBy('status')
                    ->orderByDesc('count')
                    ->get(),
                'risk_indicators' => SoaStatement::query()
                    ->with('borrower:id,name,email,credit_score,risk_level')
                    ->whereBetween('statement_month', [$start->toDateString(), $end->toDateString()])
                    ->where(function ($q): void {
                        $q->where('due_date', '<', now()->toDateString())->orWhere('penalties', '>', 0);
                    })
                    ->orderByDesc('total_due')
                    ->limit(20)
                    ->get()
                    ->map(fn (SoaStatement $statement) => [
                        'soa_id' => $statement->id,
                        'borrower' => $statement->borrower?->name,
                        'email' => $statement->borrower?->email,
                        'risk_level' => $statement->borrower?->risk_level,
                        'credit_score' => $statement->borrower?->credit_score !== null ? (float) $statement->borrower->credit_score : null,
                        'total_due' => (float) $statement->total_due,
                        'penalties' => (float) $statement->penalties,
                        'due_date' => $statement->due_date?->toDateString(),
                    ]),
            ];
        });

        $payload['environment'] = [
            'pdf_gd' => PdfSupport::hasGd(),
            'pdf_hint' => PdfSupport::hasGd() ? null : PdfSupport::gdInstallHint(),
        ];

        return $payload;
    }

    public function soaDashboardForRequest(Request $request): array
    {
        $month = $request->query('month');
        $start = $month ? Carbon::parse($month)->startOfMonth() : now()->subMonths(6)->startOfMonth();
        $end = $month ? Carbon::parse($month)->endOfMonth() : now()->endOfDay();
        $status = trim((string) $request->query('status', ''));
        $term = trim((string) $request->query('q', ''));
        $cacheKey = 'soa_analytics_filtered:'.md5(json_encode([$start->toDateString(), $end->toDateString(), $status, $term]));

        $payload = Cache::remember($cacheKey, now()->addMinutes(3), function () use ($start, $end, $status, $term): array {
            $base = $this->filteredSoaBase($start, $end, $status, $term);
            $paidPayments = Payment::query()->where('status', Payment::STATUS_PAID)->whereBetween('paid_at', [$start, $end]);
            $statementIds = (clone $base)->pluck('id');

            return [
                'summary' => [
                    'total_generated' => (clone $base)->count(),
                    'total_due' => round((float) (clone $base)->sum('total_due'), 2),
                    'outstanding_balance' => round((float) (clone $base)->sum('remaining_balance'), 2),
                    'penalties' => round((float) (clone $base)->sum('penalties'), 2),
                    'email_sent' => (clone $base)->where('email_sent', true)->count(),
                    'email_failed' => EmailLog::query()
                        ->whereIn('soa_id', $statementIds)
                        ->where('notification_type', EmailLog::NOTIFICATION_SOA_STATEMENT)
                        ->where('status', EmailLog::STATUS_FAILED)
                        ->count(),
                    'viewed' => (clone $base)->whereNotNull('viewed_at')->count(),
                    'downloaded' => (clone $base)->whereNotNull('downloaded_at')->count(),
                    'paid_collections' => round((float) (clone $paidPayments)->sum('amount_paid'), 2),
                    'overdue_accounts' => (clone $base)->where('due_date', '<', now()->toDateString())->whereNotIn('status', [SoaStatement::STATUS_PAID])->count(),
                ],
                'monthly_trends' => (clone $base)
                    ->selectRaw("DATE_FORMAT(statement_month, '%Y-%m') as month, COUNT(*) as generated_count, COALESCE(SUM(total_due),0) as projected, COALESCE(SUM(remaining_balance),0) as outstanding, COALESCE(SUM(penalties),0) as penalties")
                    ->groupBy(DB::raw("DATE_FORMAT(statement_month, '%Y-%m')"))
                    ->orderBy('month')
                    ->get(),
                'status_breakdown' => (clone $base)
                    ->selectRaw('status, COUNT(*) as count, COALESCE(SUM(total_due),0) as total_due')
                    ->groupBy('status')
                    ->orderByDesc('count')
                    ->get(),
            ];
        });

        $payload['environment'] = [
            'pdf_gd' => PdfSupport::hasGd(),
            'pdf_hint' => PdfSupport::hasGd() ? null : PdfSupport::gdInstallHint(),
        ];

        return $payload;
    }

    private function filteredSoaBase(Carbon $start, Carbon $end, string $status, string $term): Builder
    {
        return SoaStatement::query()
            ->whereBetween('statement_month', [$start->toDateString(), $end->toDateString()])
            ->when($status !== '', fn (Builder $query) => $query->where('status', $status))
            ->when($term !== '', function (Builder $query) use ($term): void {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $term).'%';
                $loanId = preg_replace('/\D+/', '', $term);
                $query->where(function (Builder $nested) use ($like, $loanId): void {
                    $nested->whereHas('borrower', fn (Builder $borrower) => $borrower->where('name', 'like', $like)->orWhere('email', 'like', $like));

                    if ($loanId !== '') {
                        $nested->orWhere('loan_id', (int) $loanId);
                    }
                });
            });
    }
}
