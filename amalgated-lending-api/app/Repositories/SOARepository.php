<?php

namespace App\Repositories;

use App\Models\SoaStatement;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class SOARepository
{
    public function filtered(Request $request): LengthAwarePaginator
    {
        return $this->queryForFilters($request)
            ->orderByDesc('statement_month')
            ->orderByDesc('id')
            ->paginate(min(100, max(10, (int) $request->query('per_page', 20))));
    }

    public function queryForFilters(Request $request): Builder
    {
        return SoaStatement::query()
            ->with(['borrower:id,name,email,credit_score,risk_level', 'loan:id,borrower_id,principal,status,outstanding_balance,monthly_payment'])
            ->when($request->query('status'), fn (Builder $q, string $status) => $q->where('status', $status))
            ->when($request->query('borrower_id'), fn (Builder $q, string $id) => $q->where('borrower_id', (int) $id))
            ->when($request->query('loan_id'), fn (Builder $q, string $id) => $q->where('loan_id', (int) $id))
            ->when($request->query('month'), function (Builder $q, string $month): void {
                $q->whereDate('statement_month', Carbon::parse($month)->startOfMonth()->toDateString());
            })
            ->when($request->query('q'), function (Builder $q, string $term): void {
                $raw = trim($term);
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $raw).'%';
                $loanId = preg_replace('/\D+/', '', $raw);
                $q->where(function (Builder $nested) use ($like, $loanId): void {
                    $nested->whereHas('borrower', fn (Builder $b) => $b->where('name', 'like', $like)->orWhere('email', 'like', $like));

                    if ($loanId !== '') {
                        $nested->orWhere('loan_id', (int) $loanId);
                    }
                });
            });
    }

    public function findForBorrower(int $statementId, int $borrowerId): ?SoaStatement
    {
        return SoaStatement::query()
            ->whereKey($statementId)
            ->where('borrower_id', $borrowerId)
            ->visibleToBorrowerPortal()
            ->with(['borrower', 'loan.payments'])
            ->first();
    }
}
