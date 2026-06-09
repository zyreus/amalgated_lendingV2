<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LoanStatement;
use App\Models\SoaStatement;
use App\Repositories\SOARepository;
use App\Services\PDFGenerationService;
use App\Services\SOAService;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\View;

class BorrowerStatementController extends Controller
{
    public function __construct(
        private readonly SOARepository $soaStatements,
        private readonly PDFGenerationService $soaPdfs,
        private readonly SOAService $soaService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $soaStatements = SoaStatement::query()
            ->where('borrower_id', $request->user()->id)
            ->visibleToBorrowerPortal()
            ->with(['loan:id,borrower_id,principal,status,outstanding_balance,monthly_payment'])
            ->orderByDesc('statement_month')
            ->orderByDesc('id')
            ->get()
            ->map(fn (SoaStatement $statement) => $this->serializeSoaStatement($statement))
            ->values();

        if ($soaStatements->isNotEmpty()) {
            return response()->json([
                'ok' => true,
                'data' => $soaStatements,
            ]);
        }

        $statements = LoanStatement::query()
            ->where('borrower_id', $request->user()->id)
            ->with(['loan:id,borrower_id'])
            ->orderByDesc('period')
            ->orderByDesc('id')
            ->get()
            ->map(fn (LoanStatement $statement) => $this->serializeStatement($statement))
            ->values();

        return response()->json([
            'ok' => true,
            'data' => $statements,
        ]);
    }

    public function show(Request $request, string|int $statement): JsonResponse
    {
        $soa = $this->soaStatements->findForBorrower((int) $statement, (int) $request->user()->id);
        if (! $soa) {
            return response()->json(['ok' => false, 'message' => 'Statement not found.'], 404);
        }

        $this->soaService->markViewed($soa);
        $soa->refresh()->loadMissing(['loan:id,borrower_id,principal,status,outstanding_balance,monthly_payment']);

        return response()->json([
            'ok' => true,
            'data' => $this->serializeSoaStatement($soa),
        ]);
    }

    public function download(Request $request, string|int $statement): Response|JsonResponse
    {
        $statementId = (int) $statement;
        $soa = $this->soaStatements->findForBorrower($statementId, (int) $request->user()->id);
        if ($soa) {
            $this->soaService->markViewed($soa);
            $path = $this->soaPdfs->ensureSoaPdf($soa);
            $this->soaService->markDownloaded($soa);

            return response(\Illuminate\Support\Facades\Storage::disk('public')->get($path), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="SOA-'.$soa->statement_month?->format('Y-m').'-'.$soa->id.'.pdf"',
            ]);
        }

        $statement = LoanStatement::query()->findOrFail($statementId);

        if ((int) $statement->borrower_id !== (int) $request->user()->id) {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }

        $statement->loadMissing(['borrower', 'loan']);

        $html = View::make('pdf.borrower-loan-statement', [
            'statement' => $statement,
            'borrower' => $statement->borrower,
            'loan' => $statement->loan,
            'companyName' => config('app.name', 'Amalgated Lending Inc.'),
            'generatedAt' => now()->format('F j, Y g:i A'),
            'periodLabel' => $statement->period?->format('F Y') ?? 'Statement',
            'dueDateLabel' => $statement->due_date?->format('F j, Y') ?? '—',
            'loanAmount' => number_format((float) $statement->loan_amount, 2),
            'remainingBalance' => number_format((float) $statement->remaining_balance, 2),
            'monthlyDue' => number_format((float) $statement->monthly_due, 2),
            'logoDataUri' => $this->logoDataUri(),
        ])->render();

        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [public_path(), storage_path('app/public')]);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $filename = sprintf(
            'Loan-Statement-%s-%s.pdf',
            preg_replace('/[^A-Za-z0-9._-]+/', '_', $statement->loan_account_no) ?: 'Loan',
            $statement->period?->format('Y-m') ?? $statement->id
        );

        return response($dompdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeStatement(LoanStatement $statement): array
    {
        return [
            'id' => $statement->id,
            'period' => $statement->period?->toDateString(),
            'period_label' => $statement->period?->format('M Y') ?? '—',
            'statement_type' => 'Loan statement',
            'loan_account_no' => $statement->loan_account_no,
            'loan_amount' => (float) $statement->loan_amount,
            'remaining_balance' => (float) $statement->remaining_balance,
            'monthly_due' => (float) $statement->monthly_due,
            'due_date' => $statement->due_date?->toDateString(),
            'download_url' => '/api/v1/borrower/statements/'.$statement->id.'/download',
            'created_at' => $statement->created_at?->toIso8601String(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeSoaStatement(SoaStatement $statement): array
    {
        return [
            'id' => $statement->id,
            'period' => $statement->statement_month?->toDateString(),
            'period_label' => $statement->statement_month?->format('M Y') ?? '—',
            'statement_type' => 'Statement of Account',
            'statement_number' => $statement->statement_number,
            'loan_account_no' => $statement->loan?->loan_number ?? ('LN-'.str_pad((string) $statement->loan_id, 6, '0', STR_PAD_LEFT)),
            'monthly_due' => (float) $statement->monthly_due,
            'penalties' => (float) $statement->penalties,
            'remaining_balance' => (float) $statement->remaining_balance,
            'total_due' => (float) $statement->total_due,
            'status' => $statement->status,
            'email_sent' => (bool) $statement->email_sent,
            'viewed_at' => $statement->viewed_at?->toIso8601String(),
            'downloaded_at' => $statement->downloaded_at?->toIso8601String(),
            'due_date' => $statement->due_date?->toDateString(),
            'payment_history' => $statement->snapshot['payment_history'] ?? [],
            'download_url' => '/api/v1/borrower/statements/'.$statement->id.'/download',
            'created_at' => $statement->created_at?->toIso8601String(),
        ];
    }

    private function logoDataUri(): ?string
    {
        $path = public_path('amalgated-lending-logo.png');
        if (! File::exists($path)) {
            return null;
        }

        $bytes = File::get($path);
        if (! is_string($bytes) || $bytes === '') {
            return null;
        }

        return 'data:image/png;base64,'.base64_encode($bytes);
    }
}
