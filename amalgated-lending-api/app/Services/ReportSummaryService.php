<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\Payment;
use Carbon\Carbon;
use Illuminate\Http\Request;
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
}
