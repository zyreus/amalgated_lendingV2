<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Blocks anonymous public loan application submissions (Phase 1 portal migration).
 */
class PublicApplicationDisabledController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $base = rtrim((string) config('app.frontend_url', (string) config('app.url')), '/');

        return response()->json([
            'ok' => false,
            'code' => 'auth_required',
            'message' => 'Loan applications must be submitted through the Borrower Portal. Please sign in or create a borrower account.',
            'login_url' => $base.'/borrower/login',
            'register_url' => $base.'/borrower/register',
        ], 401);
    }
}
