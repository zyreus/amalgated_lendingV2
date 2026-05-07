<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\IndexLoanApplicationRequest;
use App\Http\Requests\Api\StoreLoanApplicationRequest;
use App\Http\Requests\Api\UpdateLoanApplicationRequest;
use App\Http\Resources\LoanApplicationResource;
use App\Models\LoanApplication;
use App\Services\LoanCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LoanApplicationController extends Controller
{
    public function __construct(
        private LoanCalculator $calculator,
    ) {}

    public function index(IndexLoanApplicationRequest $request): JsonResponse
    {
        $user = $request->user();
        $q = LoanApplication::query()->with(['loanProduct', 'borrower:id,name,email']);

        if (! $this->canViewAll($request)) {
            $q->where('user_id', $user->id);
        } elseif ($request->boolean('mine')) {
            $q->where('user_id', $user->id);
        }

        $data = $request->validated();
        if (! empty($data['status'])) {
            $q->where('status', $data['status']);
        }
        if (! empty($data['loan_product_id'])) {
            $q->where('loan_product_id', (int) $data['loan_product_id']);
        }

        $rows = $q->orderByDesc('id')->paginate((int) ($data['per_page'] ?? 15));
        $rows->setCollection(LoanApplicationResource::collection($rows->getCollection())->collection);

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function show(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        if (! $this->canAccess($request, $loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loanApplication->load(['loanProduct', 'borrower:id,name,email']);

        return response()->json(['ok' => true, 'data' => new LoanApplicationResource($loanApplication)]);
    }

    public function store(StoreLoanApplicationRequest $request): JsonResponse
    {
        $payload = $request->validated();
        $user = $request->user();

        $compute = $this->calculator->compute([
            'product_id' => (int) $payload['loan_product_id'],
            'loan_amount' => (float) $payload['loan_amount'],
            'term_months' => (int) $payload['term_months'],
            'application_nature' => (string) ($payload['application_nature'] ?? 'new'),
            'age' => $payload['age'] ?? null,
            'monthly_pension' => $payload['monthly_pension'] ?? null,
        ]);

        $formData = is_array($payload['form_data'] ?? null) ? $payload['form_data'] : [];
        $formData['application_nature'] = (string) ($payload['application_nature'] ?? 'new');

        $app = LoanApplication::create([
            'user_id' => $user->id,
            'loan_product_id' => (int) $payload['loan_product_id'],
            'loan_type' => (string) ($payload['loan_type'] ?? LoanApplication::TYPE_CHATTEL),
            'loan_amount' => (float) $payload['loan_amount'],
            'term_months' => (int) $payload['term_months'],
            'status' => (string) ($payload['status'] ?? LoanApplication::STATUS_PENDING),
            'co_maker_name' => $payload['co_maker_name'] ?? null,
            'co_maker_email' => $payload['co_maker_email'] ?? null,
            'co_maker_phone' => $payload['co_maker_phone'] ?? null,
            'form_data' => $formData,
            'documents' => $payload['documents'] ?? null,
            'computed_values' => [
                'monthly_rate_percent_effective' => $compute['product']['monthly_rate_percent_effective'] ?? null,
                'monthly_amortization' => $compute['breakdown']['monthly_amortization'] ?? null,
                'net_proceeds' => $compute['breakdown']['net_proceeds'] ?? null,
            ],
            'computation_breakdown' => $compute,
        ]);

        $app->load(['loanProduct', 'borrower:id,name,email']);

        return response()->json([
            'ok' => true,
            'data' => new LoanApplicationResource($app),
        ], 201);
    }

    public function update(UpdateLoanApplicationRequest $request, LoanApplication $loanApplication): JsonResponse
    {
        if (! $this->canAccess($request, $loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $payload = $request->validated();
        $loanApplication->fill($payload);

        $needsRecompute = isset($payload['loan_product_id'])
            || isset($payload['loan_amount'])
            || isset($payload['term_months'])
            || isset($payload['loan_type'])
            || isset($payload['application_nature']);

        if ($needsRecompute) {
            $formData = is_array($loanApplication->form_data) ? $loanApplication->form_data : [];
            $nature = (string) ($payload['application_nature'] ?? ($formData['application_nature'] ?? 'new'));
            $formData['application_nature'] = $nature;
            $compute = $this->calculator->compute([
                'product_id' => (int) ($loanApplication->loan_product_id ?? 0),
                'loan_amount' => (float) ($loanApplication->loan_amount ?? 0),
                'term_months' => (int) ($loanApplication->term_months ?? 1),
                'application_nature' => $nature,
                'age' => $payload['age'] ?? null,
                'monthly_pension' => $payload['monthly_pension'] ?? null,
            ]);
            $loanApplication->form_data = $formData;
            $loanApplication->computed_values = [
                'monthly_rate_percent_effective' => $compute['product']['monthly_rate_percent_effective'] ?? null,
                'monthly_amortization' => $compute['breakdown']['monthly_amortization'] ?? null,
                'net_proceeds' => $compute['breakdown']['net_proceeds'] ?? null,
            ];
            $loanApplication->computation_breakdown = $compute;
        }

        $loanApplication->save();
        $loanApplication->load(['loanProduct', 'borrower:id,name,email']);

        return response()->json(['ok' => true, 'data' => new LoanApplicationResource($loanApplication)]);
    }

    public function destroy(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        if (! $this->canAccess($request, $loanApplication)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loanApplication->delete();

        return response()->json(['ok' => true]);
    }

    private function canViewAll(Request $request): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }

        return $user->canAccessAdminPortal() || $user->hasPermission('loans.view');
    }

    private function canAccess(Request $request, LoanApplication $loanApplication): bool
    {
        $user = $request->user();
        if (! $user) {
            return false;
        }
        if ($this->canViewAll($request)) {
            return true;
        }

        return (int) $loanApplication->user_id === (int) $user->id;
    }
}
