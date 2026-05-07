<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ComputeLoanRequest;
use App\Services\LoanCalculator;
use Illuminate\Http\JsonResponse;

class LoanComputationController extends Controller
{
    public function __construct(
        private LoanCalculator $calculator,
    ) {}

    public function compute(ComputeLoanRequest $request): JsonResponse
    {
        $result = $this->calculator->compute($request->validated());

        return response()->json([
            'ok' => true,
            'mode' => 'quick_compute',
            'data' => $result,
        ]);
    }
}
