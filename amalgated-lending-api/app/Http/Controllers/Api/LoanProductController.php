<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoanProduct;
use App\Services\LoanProductFeeCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoanProductController extends Controller
{
    /** Public: active products only */
    public function publicIndex(): JsonResponse
    {
        $rows = LoanProduct::query()
            ->active()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    /** Admin: all products */
    public function adminIndex(): JsonResponse
    {
        $rows = LoanProduct::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->normalizeProductPayload($this->validated($request));
        $product = LoanProduct::create($data);

        return response()->json(['ok' => true, 'data' => $product], 201);
    }

    public function update(Request $request, LoanProduct $loanProduct): JsonResponse
    {
        $data = $this->normalizeProductPayload($this->validated($request, $loanProduct->id));
        $loanProduct->update($data);

        return response()->json(['ok' => true, 'data' => $loanProduct->fresh()]);
    }

    private function normalizeProductPayload(array $data): array
    {
        $tier = $data['tier'] ?? null;
        $data['tier'] = in_array($tier, ['green', 'blue', 'orange'], true) ? $tier : 'blue';
        if (! isset($data['sort_order']) || $data['sort_order'] === null) {
            $data['sort_order'] = 0;
        }

        return $data;
    }

    public function destroy(LoanProduct $loanProduct): JsonResponse
    {
        $loanProduct->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Loan calculator: pension cap, amortized or straight-line amortization, optional fee breakdown (business rules).
     */
    public function calculate(Request $request): JsonResponse
    {
        $request->validate([
            'slug' => 'required|string|max:80',
            'term_months' => 'required|integer|min:1|max:600',
            'include_fees' => 'sometimes|boolean',
        ]);

        $product = LoanProduct::query()->active()->where('slug', $request->string('slug'))->first();
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Loan product not found.'], 404);
        }

        $cfg = is_array($product->calculator_config) ? $product->calculator_config : [];
        $term = (int) $request->input('term_months');
        $maxTerm = (int) ($product->max_term ?? 0);
        if ($maxTerm < 1) {
            $maxTerm = 60;
        }

        if (isset($cfg['fixed_term_months'])) {
            $fixed = (int) $cfg['fixed_term_months'];
            if ($term !== $fixed) {
                return response()->json([
                    'ok' => false,
                    'message' => "This product uses a fixed term of {$fixed} month(s) (e.g. monthly renewal).",
                ], 422);
            }
        } elseif ($term > $maxTerm) {
            return response()->json([
                'ok' => false,
                'message' => "Term cannot exceed {$maxTerm} months for this product.",
            ], 422);
        }

        $pensionMode = array_key_exists('pension_multiplier', $cfg);

        if ($pensionMode) {
            $request->validate([
                'monthly_pension' => 'required|numeric|min:0',
            ]);
            $pension = (float) $request->input('monthly_pension');
            $mult = (float) ($cfg['pension_multiplier'] ?? 10);
            $cap = (float) ($cfg['max_principal'] ?? 500000);
            $principal = min($pension * $mult, $cap);
            $mode = 'pension';
        } else {
            $request->validate([
                'principal' => 'required|numeric|min:0|max:100000000',
            ]);
            $principal = (float) $request->input('principal');
            $mode = 'principal';
        }

        if (! empty($cfg['max_principal']) && $principal > (float) $cfg['max_principal']) {
            $capFmt = number_format((float) $cfg['max_principal'], 2);

            return response()->json([
                'ok' => false,
                'message' => "Loan amount cannot exceed ₱{$capFmt} for this product.",
            ], 422);
        }

        if ($principal <= 0) {
            return response()->json([
                'ok' => true,
                'calculator_mode' => $mode,
                'estimated_loanable_amount' => 0,
                'monthly_amortization' => 0,
                'term_months' => $term,
                'note' => $pensionMode ? 'Adjust monthly pension to estimate principal.' : 'Enter a loan amount greater than zero.',
            ]);
        }

        $monthlyRatePercent = (float) $product->interest_rate;
        $feeProfile = $cfg['fee_profile'] ?? null;
        $compStyle = $cfg['computation_style'] ?? 'amortized';

        if ($feeProfile === 'travel') {
            $monthlyInterest = round($principal * ($monthlyRatePercent / 100), 2);
            $monthly = $monthlyInterest;
            $compLabel = 'travel_monthly_renewal_interest';
            $principalPart = 0.0;
        } elseif ($compStyle === 'straight_line') {
            $principalPart = round($principal / max(1, $term), 2);
            $interestPart = round($principal * ($monthlyRatePercent / 100), 2);
            $monthly = round($principalPart + $interestPart, 2);
            $compLabel = 'straight_line';
        } else {
            $rate = $monthlyRatePercent / 100;
            if ($product->rate_type === 'fixed') {
                $rate = $rate / max(1, $term);
            }
            $monthly = round($this->amortizationPayment($principal, $rate, $term), 2);
            $compLabel = 'amortized';
            $principalPart = null;
            $interestPart = null;
        }

        $includeFees = filter_var($request->input('include_fees'), FILTER_VALIDATE_BOOLEAN);
        $feeBreakdown = null;
        if ($includeFees && is_string($feeProfile)) {
            $feeBreakdown = match ($feeProfile) {
                'travel' => LoanProductFeeCalculator::travel($principal),
                'mortgage' => LoanProductFeeCalculator::mortgage($principal, $term, $monthlyRatePercent),
                'pension' => LoanProductFeeCalculator::pension($principal, $term, $monthlyRatePercent, $cfg),
                default => null,
            };
        }

        $payload = [
            'ok' => true,
            'calculator_mode' => $mode,
            'computation_style' => $compLabel,
            'estimated_loanable_amount' => round($principal, 2),
            'monthly_amortization' => $monthly,
            'term_months' => $term,
            'interest_rate_monthly_percent' => round($monthlyRatePercent, 4),
        ];

        if ($feeProfile === 'travel') {
            $payload['monthly_interest_component'] = $monthlyInterest;
            $payload['monthly_principal_component'] = 0.0;
            $payload['note'] = 'Travel assistance: monthly figure is 3.5% of principal per renewal period (illustrative).';
        } elseif ($compStyle === 'straight_line') {
            $payload['monthly_principal_component'] = $principalPart;
            $payload['monthly_interest_component'] = $interestPart;
            $payload['note'] = 'Straight-line: monthly principal = loan ÷ term; monthly interest = loan × monthly rate (on full principal).';
        }

        if ($feeBreakdown !== null) {
            $payload['fee_breakdown'] = $feeBreakdown;
        }

        return response()->json($payload);
    }

    private function amortizationPayment(float $principal, float $monthlyRate, int $months): float
    {
        if ($months < 1) {
            return 0;
        }
        if ($monthlyRate <= 0) {
            return $principal / $months;
        }
        $pow = pow(1 + $monthlyRate, $months);

        return $principal * ($monthlyRate * $pow) / ($pow - 1);
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $slugUnique = Rule::unique('loan_products', 'slug');
        if ($ignoreId) {
            $slugUnique = $slugUnique->ignore($ignoreId);
        }

        return $request->validate([
            'code' => 'nullable|string|max:40',
            'slug' => ['required', 'string', 'max:80', $slugUnique],
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:20000',
            'interest_rate' => 'required|numeric|min:0|max:100',
            'rate_type' => ['required', Rule::in(['monthly', 'fixed', 'annual'])],
            'collateral' => 'nullable|string|max:5000',
            'collateral_type' => 'nullable|string|max:120',
            'requirements' => 'nullable|string|max:5000',
            'max_term' => 'nullable|integer|min:0|max:600',
            'max_amount' => 'nullable|numeric|min:0|max:999999999999.99',
            'age_limit' => 'nullable|integer|min:0|max:120',
            'safe_age' => 'nullable|integer|min:0|max:120',
            'downpayment' => 'nullable|string|max:120',
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'tier' => ['nullable', Rule::in(['green', 'blue', 'orange'])],
            'icon_key' => 'nullable|string|max:40',
            'sample_monthly_pension' => 'nullable|numeric|min:0',
            'sample_computation_note' => 'nullable|string|max:5000',
            'calculator_config' => 'nullable|array',
            'rules' => 'nullable|array',
            'sort_order' => 'nullable|integer|min:0|max:999999',
        ]);
    }

    /** Structured checklist for document-only applications (per requirement row). */
    public function documentRequirements(LoanProduct $loanProduct): JsonResponse
    {
        if ($loanProduct->status !== 'active') {
            return response()->json(['ok' => false, 'message' => 'Product not found.'], 404);
        }

        $rows = $loanProduct->loanRequirements()->orderBy('sort_order')->orderBy('id')->get();

        return response()->json([
            'ok' => true,
            'product' => [
                'id' => $loanProduct->id,
                'name' => $loanProduct->name,
                'slug' => $loanProduct->slug,
                'description' => $loanProduct->description,
            ],
            'data' => $rows,
        ]);
    }

    public function documentRequirementsBySlug(string $slug): JsonResponse
    {
        $product = LoanProduct::query()->active()->where('slug', $slug)->first();
        if (! $product) {
            return response()->json(['ok' => false, 'message' => 'Product not found.'], 404);
        }

        return $this->documentRequirements($product);
    }
}
