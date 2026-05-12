<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\LoanCreditMemorandum;
use App\Models\LoanReceipt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TravelLoanApplicationAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = LoanApplication::query()
            ->where('loan_type', LoanApplication::TYPE_TRAVEL_ASSISTANCE)
            ->with([
                'borrower:id,name,email,phone',
                'loan:id,borrower_id,status,principal,term_months,monthly_payment,outstanding_balance',
                'travelLoanWizardForm',
            ]);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }

        if ($request->filled('date_from')) {
            $q->whereDate('created_at', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $q->whereDate('created_at', '<=', $request->query('date_to'));
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%'.$search.'%';
            $q->whereIn('user_id', function ($sub) use ($like) {
                $sub->select('id')
                    ->from('users')
                    ->where(function ($w) use ($like) {
                        $w->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $perPage = min(100, max(5, (int) $request->query('per_page', 15)));
        $page = $q->orderByDesc('id')->paginate($perPage);

        return response()->json(['ok' => true, 'data' => $page]);
    }

    public function show(LoanApplication $loanApplication): JsonResponse
    {
        if ($loanApplication->loan_type !== LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            return response()->json(['ok' => false, 'message' => 'Not a travel assistance application.'], 404);
        }

        $loanApplication->load([
            'borrower',
            'loan.receipts',
            'documents',
            'dependents',
            'contactPersons',
            'travelLoanWizardForm',
            'creditMemorandum.approver',
        ]);

        return response()->json(['ok' => true, 'loan_application' => $loanApplication]);
    }

    public function update(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        if ($loanApplication->loan_type !== LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            return response()->json(['ok' => false, 'message' => 'Not a travel assistance application.'], 404);
        }

        $data = $request->validate([
            'credit_memorandum' => 'nullable|array',
            'credit_memorandum.date_application_received' => 'nullable|date',
            'credit_memorandum.application_status' => 'nullable|string|max:32',
            'credit_memorandum.documents_status' => 'nullable|string|max:32',
            'credit_memorandum.payments_status' => 'nullable|string|max:32',
            'credit_memorandum.recommended_by' => 'nullable|string|max:255',
            'credit_memorandum.approved_rate' => 'nullable|numeric',
            'credit_memorandum.approved_amount' => 'nullable|numeric',
            'credit_memorandum.approved_date' => 'nullable|date',
            'credit_memorandum.internal_notes' => 'nullable|string',
            'loan' => 'nullable|array',
            'loan.principal' => 'nullable|numeric|min:1000',
            'loan.term_months' => 'nullable|integer|min:1|max:120',
            'loan.annual_interest_rate' => 'nullable|numeric',
        ]);

        $loan = $loanApplication->loan;
        if (! $loan) {
            return response()->json(['ok' => false, 'message' => 'Loan record missing.'], 422);
        }

        if ($loan->status === Loan::STATUS_PENDING && isset($data['loan']) && is_array($data['loan'])) {
            if (isset($data['loan']['principal'])) {
                $loan->principal = $data['loan']['principal'];
            }
            if (isset($data['loan']['term_months'])) {
                $loan->term_months = $data['loan']['term_months'];
            }
            if (isset($data['loan']['annual_interest_rate'])) {
                $loan->annual_interest_rate = $data['loan']['annual_interest_rate'];
            }
            $loan->save();
        }

        if (! empty($data['credit_memorandum']) && is_array($data['credit_memorandum'])) {
            $cm = $data['credit_memorandum'];
            $cam = LoanCreditMemorandum::firstOrNew(['loan_application_id' => $loanApplication->id]);
            foreach ([
                'date_application_received',
                'application_status',
                'documents_status',
                'payments_status',
                'recommended_by',
                'approved_rate',
                'approved_amount',
                'approved_date',
                'internal_notes',
            ] as $key) {
                if (array_key_exists($key, $cm)) {
                    $cam->{$key} = $cm[$key];
                }
            }
            if (array_key_exists('approved_amount', $cm) || array_key_exists('approved_rate', $cm)) {
                $cam->approved_by = $request->user()?->id;
            }
            $cam->save();
        }

        $loanApplication->load(['borrower', 'loan', 'creditMemorandum', 'travelLoanWizardForm']);

        return response()->json(['ok' => true, 'loan_application' => $loanApplication]);
    }

    public function destroy(LoanApplication $loanApplication): JsonResponse
    {
        if ($loanApplication->loan_type !== LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            return response()->json(['ok' => false, 'message' => 'Not a travel assistance application.'], 404);
        }

        $loan = $loanApplication->loan;
        if ($loan && $loan->status !== Loan::STATUS_PENDING) {
            return response()->json(['ok' => false, 'message' => 'Only pending applications can be deleted.'], 422);
        }

        $loanId = $loanApplication->loan_id;
        $loanApplication->delete();
        if ($loanId) {
            Loan::where('id', $loanId)->delete();
        }

        return response()->json(['ok' => true]);
    }

    public function upsertReceipt(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        if ($loanApplication->loan_type !== LoanApplication::TYPE_TRAVEL_ASSISTANCE) {
            return response()->json(['ok' => false, 'message' => 'Not a travel assistance application.'], 404);
        }

        $loan = $loanApplication->loan;
        if (! $loan) {
            return response()->json(['ok' => false, 'message' => 'Loan missing.'], 422);
        }

        $data = $request->validate([
            'borrower_name' => 'nullable|string|max:255',
            'amount' => 'nullable|numeric',
            'interest' => 'nullable|numeric',
            'total_payable' => 'nullable|numeric',
            'meta' => 'nullable|array',
        ]);

        $receipt = LoanReceipt::updateOrCreate(
            ['loan_id' => $loan->id],
            array_merge($data, [
                'updated_by' => $request->user()?->id,
            ])
        );

        return response()->json(['ok' => true, 'receipt' => $receipt]);
    }

    public function exportExcel(Request $request): StreamedResponse|JsonResponse
    {
        $q = LoanApplication::query()
            ->where('loan_type', LoanApplication::TYPE_TRAVEL_ASSISTANCE)
            ->with(['borrower', 'loan']);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $q->whereHas('borrower', function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%');
            });
        }

        $rows = $q->orderByDesc('id')->limit(5000)->get();

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="travel-loan-applications.csv"',
        ];

        $callback = function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, ['ID', 'Borrower', 'Email', 'Principal', 'Status', 'Loan status', 'Created']);
            foreach ($rows as $app) {
                $b = $app->borrower;
                $loan = $app->loan;
                fputcsv($out, [
                    $app->id,
                    $b?->name,
                    $b?->email,
                    $loan?->principal,
                    $app->status,
                    $loan?->status,
                    $app->created_at?->toDateTimeString(),
                ]);
            }
            fclose($out);
        };

        return Response::stream($callback, 200, $headers);
    }
}
