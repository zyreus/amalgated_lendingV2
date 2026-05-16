<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerCreditWellness;
use App\Models\User;
use App\Models\WellnessHistory;
use App\Services\CreditWellnessService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CreditWellnessController extends Controller
{
    public function __construct(
        private readonly CreditWellnessService $wellnessService,
    ) {}

    /** Borrower dashboard — GET /borrower/credit-wellness */
    public function borrowerDashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        $payload = $this->wellnessService->dashboardPayload($user);

        return response()->json(['ok' => true, 'data' => $payload]);
    }

    /** Borrower eligibility for applications */
    public function borrowerEligibility(Request $request): JsonResponse
    {
        $impact = $this->wellnessService->eligibilityImpactForUser($request->user());

        return response()->json(['ok' => true, 'data' => $impact]);
    }

    /** Admin portfolio — GET /credit-wellness/portfolio */
    public function portfolio(Request $request): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => $this->wellnessService->portfolioOverview(),
        ]);
    }

    /** Admin borrower detail — GET /borrowers/{borrower}/credit-wellness */
    public function showBorrower(User $borrower): JsonResponse
    {
        $wellness = BorrowerCreditWellness::query()->where('borrower_id', $borrower->id)->first();
        if (! $wellness) {
            $wellness = $this->wellnessService->recalculateForUser($borrower, notify: false);
        }

        $history = WellnessHistory::query()
            ->where('borrower_id', $borrower->id)
            ->orderByDesc('recorded_at')
            ->limit(36)
            ->get()
            ->map(fn ($h) => [
                'score' => $h->score,
                'category' => $h->score_category,
                'recorded_at' => $h->recorded_at?->toIso8601String(),
            ]);

        return response()->json([
            'ok' => true,
            'data' => [
                'borrower' => [
                    'id' => $borrower->id,
                    'name' => $borrower->name,
                    'email' => $borrower->email,
                    'credit_score' => $borrower->credit_score,
                    'risk_level' => $borrower->risk_level,
                ],
                'wellness' => $wellness,
                'dashboard' => $this->wellnessService->dashboardPayload($borrower),
                'history' => $history,
            ],
        ]);
    }

    /** Admin report export — GET /credit-wellness/reports/{type} */
    public function report(Request $request, string $type): JsonResponse
    {
        $valid = ['borrower', 'portfolio', 'risk-trends', 'delayed-payments'];
        if (! in_array($type, $valid, true)) {
            return response()->json(['ok' => false, 'message' => 'Unknown report type.'], 404);
        }

        $portfolio = $this->wellnessService->portfolioOverview();
        $borrowers = BorrowerCreditWellness::query()
            ->with('borrower:id,name,email')
            ->orderByDesc('wellness_score')
            ->get()
            ->map(fn (BorrowerCreditWellness $w) => [
                'borrower_id' => $w->borrower_id,
                'name' => $w->borrower?->name,
                'email' => $w->borrower?->email,
                'wellness_score' => $w->wellness_score,
                'score_category' => $w->score_category,
                'repayment_rate' => (float) $w->repayment_rate,
                'delayed_payment_count' => $w->delayed_payment_count,
                'missed_payment_count' => $w->missed_payment_count,
                'default_risk_level' => $w->default_risk_level,
                'improvement_trend' => $w->improvement_trend,
            ]);

        $report = match ($type) {
            'portfolio' => ['portfolio' => $portfolio, 'generated_at' => now()->toIso8601String()],
            'risk-trends' => [
                'segments' => $portfolio['segments'],
                'high_risk' => $portfolio['high_risk_borrowers'],
                'improving' => $portfolio['improving_borrowers'],
                'generated_at' => now()->toIso8601String(),
            ],
            'delayed-payments' => [
                'delayed_accounts' => $portfolio['delayed_accounts'],
                'generated_at' => now()->toIso8601String(),
            ],
            default => ['borrowers' => $borrowers, 'generated_at' => now()->toIso8601String()],
        };

        return response()->json(['ok' => true, 'data' => $report]);
    }

    /** Admin recalculate — POST /borrowers/{borrower}/credit-wellness/recalculate */
    public function recalculate(User $borrower): JsonResponse
    {
        $wellness = $this->wellnessService->recalculateForUser($borrower, notify: false);

        return response()->json(['ok' => true, 'data' => $wellness]);
    }
}
