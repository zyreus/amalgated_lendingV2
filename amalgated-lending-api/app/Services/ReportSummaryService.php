<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\Payment;
use App\Models\TravelAssistanceDetail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Financial summary metrics for the admin Reports module (summary API + print audit).
 */
class ReportSummaryService
{
    /** Inclusive maximum span (abuse prevention). */
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
                'from' => ['The from and to dates are required.'],
                'to' => ['The from and to dates are required.'],
            ]);
        }

        $fromRaw = $request->get('from');
        $toRaw = $request->get('to');

        $from = $fromRaw !== null && $fromRaw !== ''
            ? Carbon::parse((string) $fromRaw)->startOfDay()
            : now()->subMonths(3)->startOfDay();
        $to = $toRaw !== null && $toRaw !== ''
            ? Carbon::parse((string) $toRaw)->endOfDay()
            : now()->endOfDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must be before or equal to the to date.'],
            ]);
        }

        if ($from->diffInDays($to) > self::MAX_RANGE_DAYS) {
            throw ValidationException::withMessages([
                'to' => ['The selected date range is too large for one report. Please choose a shorter period.'],
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
            ->whereIn('status', array_merge(Loan::activeServicingStatuses(), ['ongoing']));

        $collections = Payment::query()
            ->whereBetween('paid_at', [$from, $to])
            ->whereNotNull('paid_at');

        return [
            'applications_submitted' => (clone $applications)->count(),
            'loans_disbursed' => (clone $disbursed)->count(),
            'principal_disbursed' => round((float) (clone $disbursed)->sum('principal'), 2),
            'collections' => round((float) $collections->sum('amount_paid'), 2),
            'travel_assistance' => $this->summarizeTravelAssistance($from, $to),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function summarizeTravelAssistance(Carbon $from, Carbon $to): array
    {
        $base = LoanApplication::query()
            ->where('loan_type', LoanApplication::TYPE_TRAVEL_ASSISTANCE)
            ->whereBetween('created_at', [$from, $to]);
        $total = (clone $base)->count();
        $approved = (clone $base)->whereIn('status', [LoanApplication::STATUS_APPROVED, LoanApplication::STATUS_PRE_APPROVED])->count();
        $releasedLoanIds = (clone $base)->whereNotNull('loan_id')->pluck('loan_id');

        return [
            'total_applications' => $total,
            'by_destination_country' => TravelAssistanceDetail::query()
                ->whereHas('loanApplication', fn ($q) => $q->whereBetween('created_at', [$from, $to]))
                ->select('destination_country', DB::raw('COUNT(*) as count'))
                ->whereNotNull('destination_country')
                ->groupBy('destination_country')
                ->orderByDesc('count')
                ->get(),
            'ofw_applications' => TravelAssistanceDetail::query()
                ->whereHas('loanApplication', fn ($q) => $q->whereBetween('created_at', [$from, $to]))
                ->where('travel_purpose', 'OFW Deployment')
                ->count(),
            'tourist_applications' => TravelAssistanceDetail::query()
                ->whereHas('loanApplication', fn ($q) => $q->whereBetween('created_at', [$from, $to]))
                ->where('travel_purpose', 'Tourist Travel')
                ->count(),
            'approval_rate' => $total > 0 ? round(($approved / $total) * 100, 2) : 0.0,
            'released_loan_amount' => round((float) Loan::query()->whereIn('id', $releasedLoanIds)->sum('principal'), 2),
            'travel_loan_revenue' => round((float) Payment::query()->whereIn('loan_id', $releasedLoanIds)->sum('amount_paid'), 2),
        ];
    }
}
