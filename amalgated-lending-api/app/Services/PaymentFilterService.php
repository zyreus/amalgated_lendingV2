<?php

namespace App\Services;

use App\Models\Payment;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class PaymentFilterService
{
    public function baseQuery(): Builder
    {
        return Payment::query()
            ->with([
                'loan' => fn ($rel) => $rel->select([
                    'id', 'borrower_id', 'assigned_officer_id', 'term_months', 'outstanding_balance', 'status', 'principal',
                ]),
                'loan.borrower:id,name,email',
                'loan.assignedOfficer:id,name,email',
                'confirmedByUser:id,name',
                'recordedByUser:id,name',
                'encodedByUser:id,name',
                'verifiedByUser:id,name',
                'approvedByUser:id,name',
                'receiptIssuedByUser:id,name',
            ]);
    }

    public function apply(Builder $query, Request $request): Builder
    {
        $this->applyIdentityFilters($query, $request);
        $this->applyReceiptFilters($query, $request);
        $this->applyStatusFilters($query, $request);
        $this->applyWorkflowFilters($query, $request);
        $this->applyPeopleFilters($query, $request);
        $this->applyDateFilters($query, $request);

        return $query;
    }

    public function sort(Builder $query, Request $request): Builder
    {
        $sort = (string) $request->query('sort', 'due_date');
        $direction = strtolower((string) $request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';

        return match ($sort) {
            'borrower' => $query
                ->leftJoin('loans as sort_loans', 'payments.loan_id', '=', 'sort_loans.id')
                ->leftJoin('users as sort_borrowers', 'sort_loans.borrower_id', '=', 'sort_borrowers.id')
                ->select('payments.*')
                ->orderBy('sort_borrowers.name', $direction)
                ->orderByDesc('payments.due_date'),
            'loan' => $query->orderBy('loan_id', $direction)->orderBy('installment_no', 'asc'),
            'due_amount' => $query->orderBy('amount_due', $direction),
            'remaining' => $query->orderByRaw('(amount_due - COALESCE(amount_paid, 0)) '.$direction),
            'paid_amount' => $query->orderBy('amount_paid', $direction),
            'status' => $query->orderBy('status', $direction)->orderByDesc('due_date'),
            'or_number' => $query->orderBy('official_receipt_number', $direction),
            'ar_number' => $query->orderBy('acknowledgement_receipt_number', $direction),
            default => $query->orderBy('due_date', $direction)->orderByDesc('id'),
        };
    }

    private function applyIdentityFilters(Builder $query, Request $request): void
    {
        if ($request->filled('payment_id')) {
            $query->whereKey((int) $request->query('payment_id'));
        }

        if ($request->filled('loan_id')) {
            $query->where('loan_id', (int) $request->query('loan_id'));
        }

        if ($request->filled('borrower_id')) {
            $borrowerId = (int) $request->query('borrower_id');
            $query->whereHas('loan', fn ($loanQuery) => $loanQuery->where('borrower_id', $borrowerId));
        }

        if ($request->filled('borrower_search')) {
            $term = trim((string) $request->query('borrower_search'));
            $tokens = preg_split('/\s+/', $term, -1, PREG_SPLIT_NO_EMPTY) ?: [];
            $query->whereHas('loan.borrower', function (Builder $borrowerQuery) use ($term, $tokens): void {
                $borrowerQuery->where(function (Builder $nameQuery) use ($term, $tokens): void {
                    $nameQuery->where('name', 'like', '%'.$term.'%')
                        ->orWhere('email', 'like', '%'.$term.'%');

                    foreach ($tokens as $token) {
                        $nameQuery->orWhere('name', 'like', '%'.$token.'%')
                            ->orWhere('email', 'like', '%'.$token.'%');
                    }
                });
            });
        }

        if ($request->filled('loan_search')) {
            $this->applyLoanSearch($query, trim((string) $request->query('loan_search')));
        }

        if ($request->query('loan_scope') === 'assigned') {
            $user = $request->user();
            if ($user instanceof User) {
                app(StaffScopeService::class)->applyAssignedLoanScopeViaRelation($query, $user);
            }
        } elseif ($request->user() instanceof User) {
            app(StaffScopeService::class)->applyAssignedLoanScopeViaRelation($query, $request->user());
        }
    }

    private function applyLoanSearch(Builder $query, string $raw): void
    {
        if ($raw === '') {
            return;
        }

        $lower = strtolower($raw);
        $digits = preg_replace('/\D+/', '', $raw) ?? '';

        $query->where(function (Builder $loanQuery) use ($raw, $lower, $digits): void {
            if (preg_match('/^ln-0*(\d+)$/i', $raw, $match) || preg_match('/^#?(\d+)$/', $raw, $match)) {
                $loanQuery->orWhere('loan_id', (int) $match[1]);
            }

            if ($digits !== '') {
                $needle = ltrim($digits, '0');
                if ($needle !== '') {
                    $loanQuery->orWhere('loan_id', 'like', '%'.$needle.'%');
                }
                $loanQuery->orWhereHas('loan', function (Builder $loanModelQuery) use ($digits): void {
                    $loanModelQuery->whereRaw("LOWER(CONCAT('ln-', LPAD(CAST(id AS CHAR), 6, '0'))) LIKE ?", ['%'.strtolower($digits).'%'])
                        ->orWhereRaw("LPAD(CAST(id AS CHAR), 6, '0') LIKE ?", ['%'.$digits.'%']);
                });
            }

            $loanQuery->orWhereHas('loan', function (Builder $loanModelQuery) use ($lower): void {
                $loanModelQuery->whereRaw("LOWER(CONCAT('ln-', LPAD(CAST(id AS CHAR), 6, '0'))) LIKE ?", ['%'.$lower.'%']);
            });
        });
    }

    private function applyReceiptFilters(Builder $query, Request $request): void
    {
        if ($request->filled('official_receipt_q')) {
            $term = strtolower(trim((string) $request->query('official_receipt_q')));
            $query->whereRaw('LOWER(COALESCE(official_receipt_number, "")) LIKE ?', ['%'.$term.'%']);
        }

        if ($request->filled('or_from')) {
            $query->where('official_receipt_number', '>=', strtoupper(trim((string) $request->query('or_from'))));
        }
        if ($request->filled('or_to')) {
            $query->where('official_receipt_number', '<=', strtoupper(trim((string) $request->query('or_to'))));
        }

        if ($request->filled('acknowledgement_receipt_q')) {
            $term = strtolower(trim((string) $request->query('acknowledgement_receipt_q')));
            $query->whereRaw('LOWER(COALESCE(acknowledgement_receipt_number, "")) LIKE ?', ['%'.$term.'%']);
        }

        if ($request->filled('ar_from')) {
            $query->where('acknowledgement_receipt_number', '>=', strtoupper(trim((string) $request->query('ar_from'))));
        }
        if ($request->filled('ar_to')) {
            $query->where('acknowledgement_receipt_number', '<=', strtoupper(trim((string) $request->query('ar_to'))));
        }

        if ($request->filled('receipt_document_coverage')) {
            $this->applyReceiptCoverage($query, (string) $request->query('receipt_document_coverage'));
        }
    }

    private function applyStatusFilters(Builder $query, Request $request): void
    {
        $status = (string) $request->query('status', '');

        match ($status) {
            Payment::STATUS_PENDING, Payment::STATUS_PAID, Payment::STATUS_PARTIAL, Payment::STATUS_OVERDUE => $query->where('status', $status),
            'missing_or' => $query->where(function (Builder $w): void {
                $w->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
            }),
            'missing_ar' => $query->where(function (Builder $w): void {
                $w->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
            }),
            'missing_both' => $this->whereMissingBothReceipts($query),
            default => null,
        };

        if ($request->filled('overdue')) {
            $query->where('status', '!=', Payment::STATUS_PAID)
                ->whereDate('due_date', '<', now()->toDateString());
        }

        if ($request->filled('outstanding_only')) {
            $query->whereNotIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
                ->whereRaw('(amount_due - COALESCE(amount_paid, 0)) > 0.009');
        }

        if ($request->filled('payment_method')) {
            $method = strtolower(trim((string) $request->query('payment_method')));
            match ($method) {
                'bank', 'bank_transfer' => $query->whereIn('payment_method', ['bank', 'bank_transfer']),
                'maya' => $query->whereIn('payment_method', ['maya', 'paymaya']),
                'cash', 'gcash' => $query->where('payment_method', $method),
                default => null,
            };
        }

        if ($request->filled('receipt_status')) {
            $query->where('receipt_status', (string) $request->query('receipt_status'));
        }
    }

    private function applyWorkflowFilters(Builder $query, Request $request): void
    {
        match ((string) $request->query('workflow', $request->query('approval_status', ''))) {
            'verified' => $query->whereNotNull('verified_by'),
            'pending_verification', 'pending' => $query
                ->whereNull('verified_by')
                ->whereIn('status', [Payment::STATUS_PENDING, Payment::STATUS_PARTIAL, Payment::STATUS_OVERDUE])
                ->where(fn (Builder $w) => $this->whereHasPaymentEvidence($w)),
            'missing_receipt', 'missing_receipts' => $query
                ->where('status', Payment::STATUS_PAID)
                ->where(function (Builder $w): void {
                    $w->whereNull('official_receipt_number')->orWhere('official_receipt_number', '')
                        ->orWhereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                }),
            'ledger', 'read_only_ledger', 'paid' => $query->where('status', Payment::STATUS_PAID),
            default => null,
        };
    }

    private function applyPeopleFilters(Builder $query, Request $request): void
    {
        if ($request->filled('recorded_by')) {
            $query->where('recorded_by', (int) $request->query('recorded_by'));
        }

        if ($request->filled('officer_user_id')) {
            $officerId = (int) $request->query('officer_user_id');
            $query->whereHas('loan', fn ($loanQuery) => $loanQuery->where('assigned_officer_id', $officerId));
        }

        if ($request->filled('collector_search')) {
            $collector = trim((string) $request->query('collector_search'));
            $query->where(function (Builder $peopleQuery) use ($collector): void {
                $started = false;
                if ($this->hasPaymentColumn('encoder_name')) {
                    $peopleQuery->where('encoder_name', 'like', '%'.$collector.'%');
                    $started = true;
                }

                if ($this->hasPaymentColumn('encoded_by')) {
                    $method = $started ? 'orWhereHas' : 'whereHas';
                    $peopleQuery->{$method}('encodedByUser', fn (Builder $userQuery) => $userQuery->where('name', 'like', '%'.$collector.'%'));
                    $started = true;
                }

                $method = $started ? 'orWhereHas' : 'whereHas';
                $peopleQuery->{$method}('recordedByUser', fn (Builder $userQuery) => $userQuery->where('name', 'like', '%'.$collector.'%'));
            });
        }

        if ($request->filled('processor_role') && $this->hasPaymentColumn('encoder_role')) {
            $role = strtolower(trim((string) $request->query('processor_role')));
            $query->whereRaw('LOWER(COALESCE(encoder_role, "")) LIKE ?', ['%'.$role.'%']);
        }

        if ($request->filled('officer_search')) {
            $officer = trim((string) $request->query('officer_search'));
            $query->whereHas('loan.assignedOfficer', fn (Builder $userQuery) => $userQuery->where('name', 'like', '%'.$officer.'%'));
        }
    }

    private function applyDateFilters(Builder $query, Request $request): void
    {
        if ($request->filled('installment_dpd_min') || $request->filled('installment_dpd_max')) {
            $minDays = $request->filled('installment_dpd_min') ? max(0, (int) $request->query('installment_dpd_min')) : 0;
            $maxDays = $request->filled('installment_dpd_max') ? max($minDays, (int) $request->query('installment_dpd_max')) : 3650;
            $query->whereDate('due_date', '<', now()->toDateString())
                ->whereNotIn('status', [Payment::STATUS_PAID, Payment::STATUS_WAIVED])
                ->whereRaw('(amount_due - COALESCE(amount_paid, 0)) > 0.009')
                ->whereDate('due_date', '<=', now()->copy()->subDays($minDays)->toDateString())
                ->whereDate('due_date', '>=', now()->copy()->subDays($maxDays)->toDateString());
        }

        $dateField = $request->query('date_field', 'paid_at') === 'due_date' ? 'due_date' : 'paid_at';
        if ($request->filled('date_from')) {
            $from = \Carbon\Carbon::parse((string) $request->query('date_from'))->startOfDay();
            $dateField === 'due_date'
                ? $query->whereDate('due_date', '>=', $from->toDateString())
                : $query->whereNotNull('paid_at')->whereDate('paid_at', '>=', $from->toDateString());
        }
        if ($request->filled('date_to')) {
            $to = \Carbon\Carbon::parse((string) $request->query('date_to'))->endOfDay();
            $dateField === 'due_date'
                ? $query->whereDate('due_date', '<=', $to->toDateString())
                : $query->whereDate('paid_at', '<=', $to->toDateString());
        }
    }

    private function applyReceiptCoverage(Builder $query, string $coverage): void
    {
        match ($coverage) {
            'or_only' => $query->where(function (Builder $w): void {
                $w->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                    ->where(function (Builder $x): void {
                        $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
                    });
            }),
            'ar_only' => $query->where(function (Builder $w): void {
                $w->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', '')
                    ->where(function (Builder $x): void {
                        $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
                    });
            }),
            'both' => $query->whereNotNull('official_receipt_number')->where('official_receipt_number', '!=', '')
                ->whereNotNull('acknowledgement_receipt_number')->where('acknowledgement_receipt_number', '!=', ''),
            'none' => $this->whereMissingBothReceipts($query),
            default => null,
        };
    }

    private function whereMissingBothReceipts(Builder $query): void
    {
        $query->where(function (Builder $w): void {
            $w->where(function (Builder $x): void {
                $x->whereNull('official_receipt_number')->orWhere('official_receipt_number', '');
            })->where(function (Builder $x): void {
                $x->whereNull('acknowledgement_receipt_number')->orWhere('acknowledgement_receipt_number', '');
            });
        });
    }

    private function whereHasPaymentEvidence(Builder $query): void
    {
        $query->where(function (Builder $w): void {
            $w->whereRaw('COALESCE(amount_paid, 0) > 0')
                ->orWhere(function (Builder $x): void {
                    $x->whereNotNull('reference_number')->where('reference_number', '!=', '');
                })
                ->orWhere(function (Builder $x): void {
                    $x->whereNotNull('receipt_path')->where('receipt_path', '!=', '');
                });
        });
    }

    private function hasPaymentColumn(string $column): bool
    {
        static $columns = [];

        if (! array_key_exists($column, $columns)) {
            $columns[$column] = Schema::hasColumn('payments', $column);
        }

        return $columns[$column];
    }
}
