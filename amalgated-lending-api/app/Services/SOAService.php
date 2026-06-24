<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\SoaLog;
use App\Models\SoaStatement;
use App\Repositories\LoanRepository;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SOAService
{
    public function __construct(
        private readonly LoanRepository $loans,
        private readonly LoanComputationService $computations,
        private readonly PDFGenerationService $pdfs,
        private readonly NotificationCenter $notifications,
    ) {}

    public function generateForLoan(Loan $loan, Carbon|string|null $month = null, ?int $createdBy = null, bool $sendEmail = false): SoaStatement
    {
        $statementMonth = $this->normalizeMonth($month);
        $loan->loadMissing(['borrower', 'payments']);
        $amounts = $this->computations->monthlyStatementAmounts($loan, $statementMonth);

        $statement = DB::transaction(function () use ($loan, $statementMonth, $createdBy, $amounts): SoaStatement {
            $statement = SoaStatement::query()->updateOrCreate(
                ['loan_id' => $loan->id, 'statement_month' => $statementMonth->toDateString()],
                [
                    'borrower_id' => $loan->borrower_id,
                    'due_date' => $amounts['due_date'],
                    'monthly_due' => $amounts['monthly_due'],
                    'penalties' => $amounts['penalties'],
                    'remaining_balance' => $amounts['remaining_balance'],
                    'total_due' => $amounts['total_due'],
                    'status' => SoaStatement::STATUS_READY,
                    'pdf_path' => null,
                    'created_by' => $createdBy,
                    'snapshot' => [
                        'loan_number' => $loan->loan_number,
                        'loan_principal' => (float) $loan->principal,
                        'monthly_payment' => (float) ($loan->monthly_payment ?? 0),
                        'term_months' => $loan->term_months,
                        'payment_history' => $amounts['payment_history'],
                        'performance' => $amounts['performance'],
                    ],
                ]
            );

            SoaLog::query()->create([
                'soa_id' => $statement->id,
                'action' => 'generated',
                'description' => 'SOA generated for '.$statementMonth->format('F Y').'.',
                'created_by' => $createdBy,
            ]);

            return $statement;
        });

        $this->pdfs->ensureSoaPdf($statement);
        $this->notifyBorrowerInApp($statement);

        if ($sendEmail) {
            $this->deferBorrowerEmail($statement, $createdBy);
        }

        return $statement->fresh(['borrower', 'loan']);
    }

    /** Send SOA email after the HTTP response — works without a queue worker. */
    private function deferBorrowerEmail(SoaStatement $statement, ?int $createdBy): void
    {
        $statementId = (int) $statement->id;
        app()->terminating(function () use ($statementId, $createdBy): void {
            try {
                $fresh = SoaStatement::query()->with(['borrower', 'loan'])->find($statementId);
                if (! $fresh) {
                    return;
                }
                app(EmailNotificationService::class)->sendSoa($fresh, $createdBy);
            } catch (\Throwable $e) {
                report($e);
                SoaLog::query()->create([
                    'soa_id' => $statementId,
                    'action' => 'email_failed',
                    'description' => 'Deferred SOA email failed: '.$e->getMessage(),
                    'created_by' => $createdBy,
                ]);
            }
        });
    }

    /**
     * @return array{generated: int, queued: int, ids: array<int, int>}
     */
    public function generateBatch(?int $borrowerId, Carbon|string|null $month, ?int $createdBy, bool $sendEmail, ?string $borrowerName = null): array
    {
        $ids = [];
        foreach ($this->loans->activeLoansForStatements($borrowerId, $borrowerName) as $loan) {
            $statement = $this->generateForLoan($loan, $month, $createdBy, $sendEmail);
            $ids[] = (int) $statement->id;
        }

        return ['generated' => count($ids), 'queued' => $sendEmail ? count($ids) : 0, 'ids' => $ids];
    }

    public function markViewed(SoaStatement $statement): void
    {
        if (! $statement->viewed_at) {
            $statement->forceFill(['viewed_at' => now(), 'status' => SoaStatement::STATUS_VIEWED])->save();
            SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'viewed', 'description' => 'Borrower viewed statement.']);
        }
    }

    public function markDownloaded(SoaStatement $statement): void
    {
        $statement->forceFill(['downloaded_at' => now()])->save();
        SoaLog::query()->create(['soa_id' => $statement->id, 'action' => 'downloaded', 'description' => 'Statement PDF downloaded.']);
    }

    private function normalizeMonth(Carbon|string|null $month): Carbon
    {
        return ($month instanceof Carbon ? $month : Carbon::parse($month ?: now()))->startOfMonth();
    }

    private function notifyBorrowerInApp(SoaStatement $statement): void
    {
        $statement->loadMissing('borrower');
        if (! $statement->borrower) {
            return;
        }

        try {
            $this->notifications->notifyBorrower(
                $statement->borrower,
                NotificationCenter::CATEGORY_PAYMENT_DUE,
                'soa_statement',
                'Monthly statement is ready',
                'Your '.$statement->statement_month?->format('F Y').' statement of account is available in the borrower portal.',
                ['soa_id' => $statement->id, 'loan_id' => $statement->loan_id, 'total_due' => (float) $statement->total_due],
                ['dedupe_key' => 'soa:'.$statement->id, 'module' => NotificationCenter::MODULE_PAYMENTS]
            );
        } catch (\Throwable $e) {
            report($e);
        }
    }
}
