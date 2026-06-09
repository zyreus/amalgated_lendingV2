<?php

namespace App\Repositories;

use App\Models\Loan;
use Illuminate\Database\Eloquent\Collection;

class LoanRepository
{
    /**
     * @return Collection<int, Loan>
     */
    public function activeLoansForStatements(?int $borrowerId = null, ?string $borrowerName = null): Collection
    {
        $name = trim((string) $borrowerName);

        return Loan::query()
            ->with(['borrower:id,name,email,phone,role,credit_score,risk_level', 'payments'])
            ->when($borrowerId, fn ($q) => $q->where('borrower_id', $borrowerId))
            ->when($name !== '', function ($q) use ($name): void {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $name).'%';
                $q->whereHas('borrower', function ($borrower) use ($like): void {
                    $borrower->where('name', 'like', $like)
                        ->orWhere('email', 'like', $like);
                });
            })
            ->whereIn('status', [Loan::STATUS_APPROVED, Loan::STATUS_ONGOING])
            ->orderBy('borrower_id')
            ->orderBy('id')
            ->get();
    }
}
