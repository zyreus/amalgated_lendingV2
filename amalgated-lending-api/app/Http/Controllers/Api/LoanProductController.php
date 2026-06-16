<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoanProduct;
use App\Services\LoanCalculationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

class LoanProductController extends Controller
{
    public function __construct(
        private readonly LoanCalculationEngine $loanEngine,
    ) {}

    /** Public: active products only */
    public function publicIndex(): JsonResponse
    {
        $rows = Cache::remember('loan_products_public_active_v1', 120, function () {
            return LoanProduct::query()
                ->active()
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();
        });

        return response()
            ->json(['ok' => true, 'data' => $rows])
            /**
             * Catalog is mostly-static — 5-minute browser/CDN cache cuts repeated hits from
             * landing-page calculator + every product page. `Cache::forget()` calls in
             * `store/update/destroy` invalidate the server-side cache; the browser cache
             * is short enough that admins see the change after one refresh window.
             */
            ->header('Cache-Control', 'public, max-age=300, must-revalidate');
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
        Cache::forget('loan_products_public_active_v1');

        return response()->json(['ok' => true, 'data' => $product], 201);
    }

    public function update(Request $request, LoanProduct $loanProduct): JsonResponse
    {
        $data = $this->normalizeProductPayload($this->validated($request, $loanProduct->id));
        $loanProduct->update($data);
        Cache::forget('loan_products_public_active_v1');

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
        Cache::forget('loan_products_public_active_v1');

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
            'application_nature' => 'sometimes|string|in:new,reloan',
            'pension_type' => 'sometimes|string|in:SSS,GSIS,sss,gsis',
            'srp' => 'sometimes|numeric|min:0',
            'purchase_channel' => 'sometimes|string|in:outside_office,in_office',
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

        if (! empty($cfg['min_principal']) && $principal > 0 && $principal < (float) $cfg['min_principal']) {
            $minFmt = number_format((float) $cfg['min_principal'], 2);

            return response()->json([
                'ok' => false,
                'message' => "Loan amount must be at least ₱{$minFmt} for this product.",
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

        $feeProfile = $cfg['fee_profile'] ?? null;
        $applicationNature = (string) $request->input('application_nature', 'new');

        $engineInput = [
            'product_slug' => $product->slug,
            'loan_amount' => $principal,
            'term_months' => $term,
            'application_nature' => $applicationNature,
            'monthly_pension' => $pensionMode ? (float) $request->input('monthly_pension') : null,
            'pension_type' => $pensionMode ? (string) $request->input('pension_type', 'SSS') : null,
        ];
        if ($product->slug === 'appliance' && $request->filled('srp')) {
            $engineInput['srp'] = (float) $request->input('srp');
            if ($request->filled('purchase_channel')) {
                $engineInput['purchase_channel'] = (string) $request->input('purchase_channel');
            }
        }

        try {
            $compute = $this->loanEngine->compute($engineInput);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'ok' => false,
                'message' => collect($e->errors())->flatten()->first() ?? 'Validation failed.',
                'errors' => $e->errors(),
            ], 422);
        }

        $prodOut = is_array($compute['product'] ?? null) ? $compute['product'] : [];
        $breakdown = is_array($compute['breakdown'] ?? null) ? $compute['breakdown'] : [];
        $inputsOut = is_array($compute['inputs'] ?? null) ? $compute['inputs'] : [];

        $monthlyRatePercent = (float) ($prodOut['monthly_rate_percent_effective'] ?? $product->interest_rate);
        $compStyleUsed = (string) ($inputsOut['computation_style_used'] ?? 'straight_line');
        $compLabel = $feeProfile === 'travel'
            ? 'travel_monthly_renewal_interest'
            : ($compStyleUsed === 'amortized' ? 'amortized_reducing_balance' : 'straight_line');

        $monthly = (float) ($breakdown['monthly_amortization'] ?? 0);
        $semiMonthly = (float) ($breakdown['semi_monthly_payment'] ?? ($monthly / 2));
        $principalPart = (float) ($breakdown['monthly_principal'] ?? 0);
        $interestPart = (float) ($breakdown['monthly_interest'] ?? 0);

        if ($feeProfile === 'travel') {
            // Public quote: monthly renewal charge is interest on full principal (principal follows contract).
            $monthly = $interestPart;
        }

        $includeFees = filter_var($request->input('include_fees'), FILTER_VALIDATE_BOOLEAN);
        $feeBreakdown = $includeFees ? $this->loanEngine->toPublicFeeBreakdown($compute) : null;

        $payload = [
            'ok' => true,
            'calculator_mode' => $mode,
            'computation_style' => $compLabel,
            'estimated_loanable_amount' => round($principal, 2),
            'monthly_amortization' => round($monthly, 2),
            'semi_monthly_payment' => round($semiMonthly, 2),
            'term_months' => $term,
            'interest_rate_monthly_percent' => round($monthlyRatePercent, 4),
        ];

        if ($feeProfile === 'travel') {
            $payload['monthly_interest_component'] = round($interestPart, 2);
            $payload['monthly_principal_component'] = 0.0;
            $payload['note'] = 'Travel assistance: monthly figure is 3.5% of principal per renewal period (illustrative).';
        } elseif ($compStyleUsed === 'straight_line') {
            $payload['monthly_principal_component'] = round($principalPart, 2);
            $payload['monthly_interest_component'] = round($interestPart, 2);
            $payload['note'] = 'Straight-line: monthly principal = loan ÷ term; monthly interest = loan × monthly rate (on full principal).';
        } else {
            $payload['monthly_principal_component'] = round($principalPart, 2);
            $payload['monthly_interest_component'] = round($interestPart, 2);
            $payload['note'] = 'Reducing-balance amortization on approved principal (standard monthly payment).';
        }

        if ($feeBreakdown !== null) {
            $payload['fee_breakdown'] = $feeBreakdown;
        }

        return response()->json($payload);
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
