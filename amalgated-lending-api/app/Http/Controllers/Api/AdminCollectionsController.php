<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanHealthMetric;
use App\Models\Payment;
use App\Models\PaymentAdjustmentAudit;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminCollectionsController extends Controller
{
    /**
     * Portfolio buckets for active (ongoing) loans, keyed by borrower account.
     * DPD = days past due on the worst delinquent installment (unpaid balance, past due date).
     * Legal / recovery = any ongoing loan flagged default_risk in {@see LoanHealthMetric} (aligned with credit wellness rules).
     */
    public function pipelineSummary(Request $request): JsonResponse
    {
        $asOf = Carbon::now()->startOfDay()->toDateString();

        $onBookBorrowerIds = Loan::query()
            ->where('status', Loan::STATUS_ONGOING)
            ->distinct()
            ->pluck('borrower_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        $legalBorrowerIds = DB::table('loans')
            ->join('loan_health_metrics as lh', 'lh.loan_id', '=', 'loans.id')
            ->where('loans.status', Loan::STATUS_ONGOING)
            ->where('lh.health_status', LoanHealthMetric::STATUS_DEFAULT_RISK)
            ->distinct()
            ->pluck('loans.borrower_id')
            ->map(fn ($id) => (int) $id)
            ->all();
        $legalSet = array_fill_keys($legalBorrowerIds, true);

        $maxDpdByBorrower = [];
        if (count($onBookBorrowerIds) > 0) {
            $rows = DB::table('payments')
                ->join('loans', 'loans.id', '=', 'payments.loan_id')
                ->where('loans.status', Loan::STATUS_ONGOING)
                ->whereNull('payments.deleted_at')
                ->whereNotIn('payments.status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
                ->whereDate('payments.due_date', '<', $asOf)
                ->whereRaw('(payments.amount_due - COALESCE(payments.amount_paid, 0)) > 0.009')
                ->selectRaw('loans.borrower_id, MAX(DATEDIFF(?, payments.due_date)) as max_dpd', [$asOf])
                ->groupBy('loans.borrower_id')
                ->get();

            foreach ($rows as $row) {
                $maxDpdByBorrower[(int) $row->borrower_id] = (int) $row->max_dpd;
            }
        }

        $current = 0;
        $early = 0;
        $serious = 0;
        $legal = 0;

        foreach ($onBookBorrowerIds as $bid) {
            if (isset($legalSet[$bid])) {
                $legal++;
                continue;
            }
            $d = $maxDpdByBorrower[$bid] ?? 0;
            if ($d >= 60) {
                $serious++;
            } elseif ($d >= 30) {
                $early++;
            } else {
                $current++;
            }
        }

        $overdueInstallments = (int) DB::table('payments')
            ->join('loans', 'loans.id', '=', 'payments.loan_id')
            ->where('loans.status', Loan::STATUS_ONGOING)
            ->whereNull('payments.deleted_at')
            ->whereNotIn('payments.status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->whereDate('payments.due_date', '<', $asOf)
            ->whereRaw('(payments.amount_due - COALESCE(payments.amount_paid, 0)) > 0.009')
            ->count();

        $overdueAmount = (float) (DB::table('payments')
            ->join('loans', 'loans.id', '=', 'payments.loan_id')
            ->where('loans.status', Loan::STATUS_ONGOING)
            ->whereNull('payments.deleted_at')
            ->whereNotIn('payments.status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
            ->whereDate('payments.due_date', '<', $asOf)
            ->whereRaw('(payments.amount_due - COALESCE(payments.amount_paid, 0)) > 0.009')
            ->selectRaw('COALESCE(SUM(GREATEST(payments.amount_due - COALESCE(payments.amount_paid, 0), 0)), 0) as s')
            ->value('s') ?? 0);

        $largeSettlementAudits = (int) PaymentAdjustmentAudit::query()
            ->where('new_amount_due', '>=', 100000)
            ->where('created_at', '>=', now()->subDays(180))
            ->count();

        return response()->json([
            'ok' => true,
            'as_of' => $asOf,
            'borrowers_on_book' => count($onBookBorrowerIds),
            'buckets' => [
                [
                    'id' => 'current_0_29',
                    'name' => 'Current (0–29 DPD)',
                    'count' => $current,
                    'description' => 'Active loans with no installment more than 29 days past due.',
                ],
                [
                    'id' => 'early_30_59',
                    'name' => 'Early delinquency (30–59)',
                    'count' => $early,
                    'description' => 'Worst open installment is 30–59 days past due.',
                ],
                [
                    'id' => 'serious_60_plus',
                    'name' => 'Serious (60+)',
                    'count' => $serious,
                    'description' => 'Worst open installment is 60+ days past due (not in legal / recovery).',
                ],
                [
                    'id' => 'legal_recovery',
                    'name' => 'Legal / recovery',
                    'count' => $legal,
                    'description' => 'Borrower has an ongoing loan in default_risk health (e.g. 90+ DPD or multiple missed installments per wellness rules).',
                ],
            ],
            'metrics' => [
                'overdue_installments' => $overdueInstallments,
                'overdue_scheduled_balance_php' => round($overdueAmount, 2),
                'large_settlement_adjustments_180d' => $largeSettlementAudits,
            ],
        ]);
    }
}
