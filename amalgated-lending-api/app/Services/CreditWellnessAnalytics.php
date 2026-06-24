<?php

namespace App\Services;

use App\Models\BorrowerCreditWellness;
use App\Models\CoMaker;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanCreditMemorandum;
use App\Models\LoanDocument;
use App\Models\Payment;
use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Dynamic credit wellness calculations from live borrower, loan, and payment data.
 */
class CreditWellnessAnalytics
{
    /** @var array<string, int> */
    public const SCORE_WEIGHTS = [
        'repayment_performance' => 35,
        'payment_consistency' => 20,
        'outstanding_balance' => 15,
        'loan_history' => 10,
        'employment_stability' => 10,
        'profile_completeness' => 5,
        'document_completeness' => 5,
    ];

    /**
     * @return array<string, mixed>
     */
    public function gatherContext(User $user): array
    {
        $user->loadMissing(['borrowerProfile']);

        $profile = $user->borrowerProfile;
        $accountAgeDays = $user->created_at ? (int) $user->created_at->diffInDays(now()) : 0;

        $applications = LoanApplication::query()
            ->where('user_id', $user->id)
            ->orderByDesc('updated_at')
            ->get();

        $submittedApplications = $applications->filter(fn (LoanApplication $a) => $a->isOfficiallySubmitted());

        $latestApp = $submittedApplications->first() ?? $applications->first();

        $latestApp?->loadMissing(['realEstateDetail', 'creditMemorandum', 'documents']);

        $monthlyIncome = $this->resolveMonthlyIncome($user, $profile, $latestApp);
        $employmentStatus = trim((string) ($profile?->employment_status ?? ''));
        if ($employmentStatus === '' && $latestApp) {
            $employmentStatus = trim((string) ($latestApp->employer_name !== null && $latestApp->employer_name !== '' ? 'Employed' : ''));
        }

        $collateralValue = null;
        $loanableValue = null;
        $loanablePct = null;

        if ($latestApp?->realEstateDetail) {
            $detail = $latestApp->realEstateDetail;
            $collateralValue = $detail->collateralValueForLtv();
            $loanableValue = $detail->loanable_value !== null ? (float) $detail->loanable_value : null;
            $loanablePct = $detail->loanable_percentage !== null ? (float) $detail->loanable_percentage : null;
            if ($loanableValue === null && $collateralValue !== null && $loanablePct !== null && $loanablePct > 0) {
                $loanableValue = round($collateralValue * ($loanablePct / 100), 2);
            }
        }

        if ($collateralValue === null && $latestApp?->property_value) {
            $collateralValue = (float) $latestApp->property_value;
        }

        $coMakerCount = CoMaker::query()
            ->whereHas('loanApplication', fn ($q) => $q->where('user_id', $user->id))
            ->count();

        $hasCoMaker = $coMakerCount > 0
            || $submittedApplications->contains(fn (LoanApplication $a) => $a->co_maker_id || trim((string) $a->co_maker_name) !== '');

        $documentStats = $this->documentCompleteness($user, $latestApp);
        $ciScore = $this->creditInvestigationScore($latestApp?->creditMemorandum);

        $approvedCount = $submittedApplications->whereIn('status', [
            LoanApplication::STATUS_APPROVED,
            LoanApplication::STATUS_PARTIALLY_APPROVED,
        ])->count();

        $rejectedCount = $submittedApplications->where('status', LoanApplication::STATUS_REJECTED)->count();

        $loanDefaults = $this->loanDefaults();

        return [
            'monthly_income' => $monthlyIncome,
            'employment_status' => $employmentStatus,
            'account_age_days' => $accountAgeDays,
            'collateral_value' => $collateralValue,
            'loanable_value' => $loanableValue,
            'loanable_percentage' => $loanablePct,
            'has_co_maker' => $hasCoMaker,
            'co_maker_count' => $coMakerCount,
            'document_stats' => $documentStats,
            'credit_investigation_score' => $ciScore,
            'submitted_application_count' => $submittedApplications->count(),
            'approved_application_count' => $approvedCount,
            'rejected_application_count' => $rejectedCount,
            'has_id_document' => trim((string) $user->id_document_path) !== '',
            'profile_fields' => $this->profileFieldStatus($user, $profile),
            'loan_defaults' => $loanDefaults,
        ];
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    public function computeComponentScores(array $metrics, array $context): array
    {
        $repaymentPerformance = (float) ($metrics['repayment_rate'] ?? 0);

        $paymentConsistency = (float) ($metrics['payment_consistency_rate'] ?? 100);

        $outstandingScore = $this->outstandingBalanceScore(
            (float) ($metrics['total_outstanding'] ?? 0),
            $context['monthly_income'],
        );

        $loanHistoryScore = $this->loanHistoryScore(
            (int) ($metrics['completed_loans'] ?? 0),
            (int) ($context['approved_application_count'] ?? 0),
            (int) ($context['rejected_application_count'] ?? 0),
            (int) ($metrics['defaulted_loans'] ?? 0),
        );

        $employmentScore = $this->employmentStabilityScore($context['employment_status'] ?? '');
        $profileScore = $this->profileCompletenessScore($context['profile_fields'] ?? []);
        $documentScore = (float) ($context['document_stats']['score'] ?? 0);

        if ((int) ($context['credit_investigation_score'] ?? 0) > 0) {
            $documentScore = round(($documentScore * 0.7) + ((float) $context['credit_investigation_score'] * 0.3), 2);
        }

        return [
            'repayment_performance' => round($repaymentPerformance, 2),
            'payment_consistency' => round($paymentConsistency, 2),
            'outstanding_balance' => round($outstandingScore, 2),
            'loan_history' => round($loanHistoryScore, 2),
            'employment_stability' => round($employmentScore, 2),
            'profile_completeness' => round($profileScore, 2),
            'document_completeness' => round($documentScore, 2),
        ];
    }

    /**
     * @param  array<string, float>  $components
     */
    public function computeWeightedScore(array $components): int
    {
        $total = 0.0;
        foreach (self::SCORE_WEIGHTS as $key => $weight) {
            $total += ((float) ($components[$key] ?? 0)) * ($weight / 100);
        }

        return max(0, min(100, (int) round($total)));
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     */
    public function hasSufficientData(User $user, Collection $loans, Collection $payments, array $metrics, array $context): bool
    {
        if ($payments->isNotEmpty()) {
            return true;
        }

        if ($loans->isNotEmpty()) {
            return true;
        }

        if ((int) ($context['submitted_application_count'] ?? 0) > 0) {
            return true;
        }

        $profile = $context['profile_fields'] ?? [];
        $hasIncome = ($context['monthly_income'] ?? null) !== null && (float) $context['monthly_income'] > 0;
        $hasEmployment = trim((string) ($context['employment_status'] ?? '')) !== '';

        if ($hasIncome && $hasEmployment && ($profile['filled'] ?? 0) >= 3) {
            return true;
        }

        return false;
    }

    public function scoreCategory(int $score): string
    {
        if ($score >= 85) {
            return BorrowerCreditWellness::CATEGORY_EXCELLENT;
        }
        if ($score >= 75) {
            return BorrowerCreditWellness::CATEGORY_GOOD;
        }
        if ($score >= 60) {
            return BorrowerCreditWellness::CATEGORY_FAIR;
        }
        if ($score >= 40) {
            return BorrowerCreditWellness::CATEGORY_AT_RISK;
        }

        return BorrowerCreditWellness::CATEGORY_CRITICAL;
    }

    /**
     * @param  array<string, float>  $components
     * @return list<array{label: string, value: float, weight: int}>
     */
    public function scoreBreakdown(array $components): array
    {
        $labels = [
            'repayment_performance' => 'Repayment performance',
            'payment_consistency' => 'Payment consistency',
            'outstanding_balance' => 'Outstanding balance',
            'loan_history' => 'Loan history',
            'employment_stability' => 'Employment stability',
            'profile_completeness' => 'Profile completeness',
            'document_completeness' => 'Document completeness',
        ];

        $items = [];
        foreach (self::SCORE_WEIGHTS as $key => $weight) {
            $items[] = [
                'label' => $labels[$key] ?? $key,
                'value' => (float) ($components[$key] ?? 0),
                'weight' => $weight,
            ];
        }

        return $items;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @param  array<string, float>  $components
     * @return array<string, mixed>
     */
    public function decisionSupport(
        int $score,
        string $category,
        string $defaultRisk,
        array $metrics,
        array $context,
        array $components,
    ): array {
        $defaults = $context['loan_defaults'] ?? $this->loanDefaults();
        $maxLoan = (float) ($defaults['max_loan'] ?? 500000);
        $incomeMultiplier = (float) ($defaults['income_loan_multiplier'] ?? 10);

        $monthlyIncome = $context['monthly_income'];
        $incomeLimit = ($monthlyIncome !== null && $monthlyIncome > 0)
            ? round($monthlyIncome * $incomeMultiplier, 2)
            : null;

        $collateralLimit = null;
        $basis = null;

        if ($context['loanable_value'] !== null && (float) $context['loanable_value'] > 0) {
            $collateralLimit = (float) $context['loanable_value'];
            $basis = 'collateral';
        } elseif ($context['collateral_value'] !== null && $context['loanable_percentage'] !== null) {
            $collateralLimit = round((float) $context['collateral_value'] * ((float) $context['loanable_percentage'] / 100), 2);
            $basis = 'collateral';
        }

        $baseLimit = null;
        if ($incomeLimit !== null && $collateralLimit !== null) {
            $baseLimit = max($incomeLimit, $collateralLimit);
            $basis = 'combined';
        } elseif ($incomeLimit !== null) {
            $baseLimit = $incomeLimit;
            $basis = 'income';
        } elseif ($collateralLimit !== null) {
            $baseLimit = $collateralLimit;
        }

        $wellnessMultiplier = $this->wellnessLimitMultiplier($category, $defaultRisk);
        $recommendedLimit = null;
        if ($baseLimit !== null) {
            $recommendedLimit = (int) round(min($maxLoan, $baseLimit * $wellnessMultiplier));
        }

        $stabilityScore = $this->stabilityScore($metrics, $context, $components);
        $confidence = $this->approvalConfidence($score, $metrics, $context, $components, $stabilityScore, $defaultRisk);
        $confidenceLabel = $this->approvalConfidenceLabel($confidence);

        return [
            'recommended_loan_limit' => $recommendedLimit,
            'recommended_loan_limit_basis' => $basis,
            'income_limit' => $incomeLimit,
            'collateral_limit' => $collateralLimit,
            'approval_confidence' => $confidence,
            'approval_confidence_label' => $confidenceLabel,
            'stability_score' => $stabilityScore,
            'risk_assessment' => $this->categoryLabel($category),
        ];
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @return list<string>
     */
    public function achievements(int $score, array $metrics, array $context, string $defaultRisk): array
    {
        $earned = [];

        $repaymentRate = (float) ($metrics['repayment_rate'] ?? 0);
        $delayedCount = (int) ($metrics['delayed_count'] ?? 0);
        $latePaymentsYtd = (int) ($metrics['late_payments_ytd'] ?? 0);

        if ($repaymentRate >= 100 && $delayedCount === 0 && $latePaymentsYtd === 0
            && ((int) ($metrics['paid_installments'] ?? 0) > 0 || (int) ($metrics['evaluated'] ?? 0) > 0)) {
            $earned[] = 'perfect_payer';
        }

        if ((int) ($metrics['completed_loans'] ?? 0) >= 2 && (int) ($metrics['defaulted_loans'] ?? 0) === 0) {
            $earned[] = 'trusted_borrower';
        }

        if ((int) ($metrics['payment_streak'] ?? 0) >= 12) {
            $earned[] = '12_month_streak';
        }

        if ((float) ($metrics['total_penalties'] ?? 0) <= 0 && (int) ($metrics['active_loan_count'] ?? 0) > 0) {
            $earned[] = 'zero_penalties';
        }

        if ($score >= 90 && (float) ($metrics['current_overdue_amount'] ?? 0) <= 0) {
            $earned[] = 'premium_member';
        }

        $docsComplete = (float) ($context['document_stats']['score'] ?? 0) >= 80;
        if ($score >= 85 && $docsComplete && $defaultRisk === 'low' && (float) ($metrics['current_overdue_amount'] ?? 0) <= 0) {
            $earned[] = 'fast_approval';
        }

        return $earned;
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @return list<array{type: string, message: string}>
     */
    public function wellnessAlerts(
        int $score,
        string $category,
        array $metrics,
        array $context,
        array $decisionSupport,
        ?int $previousScore,
    ): array {
        $alerts = [];

        if ($previousScore !== null && $score < $previousScore - 5) {
            $alerts[] = ['type' => 'warning', 'message' => 'Wellness score dropped by '.($previousScore - $score).' points recently.'];
        }

        $lateYtd = (int) ($metrics['late_payments_ytd'] ?? 0);
        if ($lateYtd > 0) {
            $alerts[] = ['type' => 'warning', 'message' => "Borrower has {$lateYtd} late payment".($lateYtd === 1 ? '' : 's').' this year.'];
        }

        if ((float) ($metrics['current_overdue_amount'] ?? 0) > 0) {
            $alerts[] = ['type' => 'urgent', 'message' => 'Missed or overdue payment detected — review account immediately.'];
        }

        if ($category === BorrowerCreditWellness::CATEGORY_EXCELLENT) {
            $alerts[] = ['type' => 'positive', 'message' => 'Borrower eligible for premium products.'];
        }

        if ($score >= 90) {
            $alerts[] = ['type' => 'positive', 'message' => 'Borrower reached Platinum tier.'];
        }

        if ($decisionSupport['approval_confidence_label'] === 'Very High' || in_array('fast_approval', $this->achievements($score, $metrics, $context, 'low'), true)) {
            $alerts[] = ['type' => 'positive', 'message' => 'Borrower qualifies for fast-track approval.'];
        }

        $recommended = $decisionSupport['recommended_loan_limit'] ?? null;
        $outstanding = (float) ($metrics['total_outstanding'] ?? 0);
        if ($recommended !== null && $recommended > 0 && $outstanding > $recommended * 0.85) {
            $alerts[] = ['type' => 'warning', 'message' => 'Outstanding balance exceeds recommended threshold.'];
        }

        if (($metrics['improvement_trend'] ?? '') === 'declining') {
            $alerts[] = ['type' => 'warning', 'message' => 'Payment consistency is declining.'];
        }

        if (in_array($category, [BorrowerCreditWellness::CATEGORY_AT_RISK, BorrowerCreditWellness::CATEGORY_CRITICAL], true)) {
            $alerts[] = ['type' => 'urgent', 'message' => 'Borrower flagged as high risk.'];
        }

        return array_slice($alerts, 0, 8);
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @param  array<string, float>  $components
     */
    public function eligibilityImpact(
        int $score,
        string $category,
        string $defaultRisk,
        array $metrics,
        array $context,
        array $components,
        array $decisionSupport,
    ): array {
        $manualReview = false;
        $limitMultiplier = 1.0;
        $fastTrack = false;
        $trustBoost = 0;

        if (in_array($category, [BorrowerCreditWellness::CATEGORY_AT_RISK, BorrowerCreditWellness::CATEGORY_CRITICAL], true)
            || $defaultRisk === 'critical') {
            $manualReview = true;
            $limitMultiplier = 0.5;
        } elseif ($category === BorrowerCreditWellness::CATEGORY_FAIR || $defaultRisk === 'high') {
            $manualReview = true;
            $limitMultiplier = 0.75;
        } elseif (in_array($category, [BorrowerCreditWellness::CATEGORY_EXCELLENT, BorrowerCreditWellness::CATEGORY_GOOD], true)) {
            $fastTrack = $score >= 85
                && (float) ($context['document_stats']['score'] ?? 0) >= 70
                && (float) ($metrics['current_overdue_amount'] ?? 0) <= 0;
            $trustBoost = $category === BorrowerCreditWellness::CATEGORY_EXCELLENT ? 15 : 8;
            $limitMultiplier = $category === BorrowerCreditWellness::CATEGORY_EXCELLENT ? 1.15 : 1.05;
        }

        return [
            'wellness_score' => $score,
            'score_category' => $category,
            'requires_manual_approval' => $manualReview,
            'loan_limit_multiplier' => $limitMultiplier,
            'fast_track_eligible' => $fastTrack,
            'trust_score_boost' => $trustBoost,
            'repayment_rate' => $metrics['repayment_rate'] ?? 0,
            'decision_support' => $decisionSupport,
            'insufficient_data' => false,
        ];
    }

    private function resolveMonthlyIncome(User $user, $profile, ?LoanApplication $app): ?float
    {
        if ($profile?->monthly_income !== null && (float) $profile->monthly_income > 0) {
            return round((float) $profile->monthly_income, 2);
        }

        if ($app?->monthly_salary !== null && (float) $app->monthly_salary > 0) {
            return round((float) $app->monthly_salary, 2);
        }

        if ($app?->monthly_pension !== null && (float) $app->monthly_pension > 0) {
            return round((float) $app->monthly_pension, 2);
        }

        $formData = is_array($app?->form_data) ? $app->form_data : [];
        foreach (['monthly_income', 'monthly_gross_income', 'monthly_net_income', 'gross_monthly_income'] as $key) {
            if (isset($formData[$key]) && is_numeric($formData[$key]) && (float) $formData[$key] > 0) {
                return round((float) $formData[$key], 2);
            }
        }

        return null;
    }

    /**
     * @return array{filled: int, total: int, score: float}
     */
    private function profileFieldStatus(User $user, $profile): array
    {
        $checks = [
            trim((string) $user->name) !== '',
            trim((string) ($user->phone ?? '')) !== '' || trim((string) ($profile?->phone_number ?? '')) !== '',
            trim((string) ($profile?->complete_address ?? $profile?->address ?? '')) !== '',
            $profile?->date_of_birth !== null,
            $profile?->monthly_income !== null && (float) $profile->monthly_income > 0,
            trim((string) ($profile?->employment_status ?? '')) !== '',
        ];

        $filled = count(array_filter($checks));

        return [
            'filled' => $filled,
            'total' => count($checks),
            'score' => round(($filled / max(1, count($checks))) * 100, 2),
        ];
    }

    /**
     * @return array{uploaded: int, verified: int, score: float}
     */
    private function documentCompleteness(User $user, ?LoanApplication $app): array
    {
        $uploaded = trim((string) $user->id_document_path) !== '' ? 1 : 0;
        $verified = $uploaded;

        if ($app) {
            $docs = LoanDocument::query()->where('loan_application_id', $app->id)->get();
            $uploaded += $docs->count();
            $verified += $docs->where('verification_status', LoanDocument::VERIFY_VERIFIED)->count();

            $legacyDocs = is_array($app->documents) ? count(array_filter($app->documents)) : 0;
            $uploaded += $legacyDocs;
            $verified += $legacyDocs;
        }

        if ($uploaded === 0) {
            return ['uploaded' => 0, 'verified' => 0, 'score' => 0.0];
        }

        return [
            'uploaded' => $uploaded,
            'verified' => $verified,
            'score' => round(min(100, ($verified / max(1, $uploaded)) * 100), 2),
        ];
    }

    private function creditInvestigationScore(?LoanCreditMemorandum $memo): float
    {
        if (! $memo) {
            return 0.0;
        }

        $score = 50.0;
        foreach (['documents_status', 'payments_status', 'application_status'] as $field) {
            $val = strtolower(trim((string) ($memo->{$field} ?? '')));
            if (in_array($val, ['good', 'verified', 'approved', 'complete', 'satisfactory'], true)) {
                $score += 15;
            } elseif (in_array($val, ['pending', 'incomplete', 'review'], true)) {
                $score += 5;
            } elseif (in_array($val, ['poor', 'rejected', 'failed'], true)) {
                $score -= 15;
            }
        }

        return max(0, min(100, round($score, 2)));
    }

    private function outstandingBalanceScore(float $outstanding, ?float $monthlyIncome): float
    {
        if ($outstanding <= 0) {
            return 100.0;
        }

        if ($monthlyIncome !== null && $monthlyIncome > 0) {
            $ratio = $outstanding / ($monthlyIncome * 12);

            return max(0, min(100, round(100 - ($ratio * 60), 2)));
        }

        return max(0, min(100, round(100 - ($outstanding / 20000), 2)));
    }

    private function loanHistoryScore(int $completed, int $approved, int $rejected, int $defaults): float
    {
        $score = 40 + ($completed * 25) + ($approved * 8) - ($rejected * 12) - ($defaults * 30);

        return max(0, min(100, round((float) $score, 2)));
    }

    private function employmentStabilityScore(string $status): float
    {
        return match (strtolower(trim($status))) {
            'employed' => 100.0,
            'self-employed', 'self employed' => 80.0,
            'retired' => 75.0,
            'student' => 60.0,
            'unemployed' => 25.0,
            default => 50.0,
        };
    }

  /**
     * @param  array{filled: int, total: int, score: float}  $profileFields
     */
    private function profileCompletenessScore(array $profileFields): float
    {
        return (float) ($profileFields['score'] ?? 0);
    }

    private function wellnessLimitMultiplier(string $category, string $defaultRisk): float
    {
        if ($defaultRisk === 'critical') {
            return 0.5;
        }
        if ($defaultRisk === 'high') {
            return 0.75;
        }

        return match ($category) {
            BorrowerCreditWellness::CATEGORY_EXCELLENT => 1.15,
            BorrowerCreditWellness::CATEGORY_GOOD => 1.05,
            BorrowerCreditWellness::CATEGORY_FAIR => 0.9,
            BorrowerCreditWellness::CATEGORY_AT_RISK => 0.65,
            default => 0.5,
        };
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @param  array<string, float>  $components
     */
    private function stabilityScore(array $metrics, array $context, array $components): int
    {
        $employment = (float) ($components['employment_stability'] ?? 50);
        $residence = trim((string) ($context['profile_fields']['filled'] ?? 0)) >= 3
            && ! empty($context['profile_fields'])
            ? 85.0
            : 50.0;
        $incomeConsistency = ($context['monthly_income'] ?? null) !== null ? 90.0 : 40.0;
        $loanPerformance = (float) ($components['repayment_performance'] ?? 0);
        $paymentHistory = min(100, ((int) ($metrics['payment_streak'] ?? 0) / 12) * 100);

        $score = ($employment * 0.25) + ($residence * 0.20) + ($incomeConsistency * 0.20)
            + ($loanPerformance * 0.20) + ($paymentHistory * 0.15);

        return max(0, min(100, (int) round($score)));
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @param  array<string, mixed>  $context
     * @param  array<string, float>  $components
     */
    private function approvalConfidence(
        int $wellnessScore,
        array $metrics,
        array $context,
        array $components,
        int $stabilityScore,
        string $defaultRisk,
    ): int {
        $confidence = ($wellnessScore * 0.30)
            + ((float) ($metrics['repayment_rate'] ?? 0) * 0.25)
            + ((float) ($components['employment_stability'] ?? 50) * 0.15)
            + ((float) ($components['document_completeness'] ?? 0) * 0.10)
            + ($stabilityScore * 0.20);

        if ((int) ($metrics['active_loan_count'] ?? 0) >= 3) {
            $confidence -= 8;
        }
        if ((float) ($metrics['current_overdue_amount'] ?? 0) > 0) {
            $confidence -= 15;
        }
        if (($context['collateral_value'] ?? null) !== null && (float) $context['collateral_value'] > 0) {
            $confidence += 5;
        }
        if ($defaultRisk === 'high') {
            $confidence -= 10;
        }
        if ($defaultRisk === 'critical') {
            $confidence -= 20;
        }

        return max(10, min(99, (int) round($confidence)));
    }

    private function approvalConfidenceLabel(int $confidence): string
    {
        if ($confidence >= 85) {
            return 'Very High';
        }
        if ($confidence >= 70) {
            return 'High';
        }
        if ($confidence >= 50) {
            return 'Medium';
        }

        return 'Low';
    }

    private function categoryLabel(string $category): string
    {
        return match ($category) {
            BorrowerCreditWellness::CATEGORY_EXCELLENT => 'Excellent',
            BorrowerCreditWellness::CATEGORY_GOOD => 'Good',
            BorrowerCreditWellness::CATEGORY_FAIR => 'Fair',
            BorrowerCreditWellness::CATEGORY_AT_RISK => 'Poor',
            BorrowerCreditWellness::CATEGORY_CRITICAL => 'Very Poor',
            default => ucwords(str_replace('_', ' ', $category)),
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function loanDefaults(): array
    {
        $row = SystemSetting::query()->where('key', 'loan_defaults')->first();
        $value = is_array($row?->value) ? $row->value : [];

        return array_merge([
            'max_loan' => 500000,
            'min_loan' => 5000,
            'income_loan_multiplier' => 10,
        ], $value);
    }

    /**
     * Count late payments in the current calendar year.
     *
     * @param  Collection<int, Payment>  $payments
     */
    public function countLatePaymentsYtd(Collection $payments): int
    {
        $yearStart = Carbon::now()->startOfYear();

        return $payments->filter(function (Payment $p) use ($yearStart) {
            if (! $p->due_date || ! $p->paid_at || (float) $p->amount_paid <= 0) {
                return false;
            }
            if ($p->due_date->lt($yearStart)) {
                return false;
            }

            return $p->paid_at->gt($p->due_date->copy()->endOfDay());
        })->count();
    }
}
