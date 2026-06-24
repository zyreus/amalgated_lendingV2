<?php

namespace App\Services;

use App\Models\Loan;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Applies admin-configured staff roles (loan officer, collector) to data visibility.
 * Loan officers see only loans assigned to them unless they hold global admin permissions.
 */
final class StaffScopeService
{
    public function primaryStaffRole(User $user): ?string
    {
        $primary = strtolower(trim((string) ($user->role ?? '')));
        if ($primary !== '' && $primary !== 'borrower') {
            return $primary;
        }

        return $user->derivePrimaryRoleFromRoles();
    }

    public function hasRoleSlug(User $user, string $slug): bool
    {
        $user->loadMissing('roles');
        $needle = strtolower(trim($slug));

        return $user->roles->contains(
            fn ($role) => strtolower((string) ($role->slug ?? '')) === $needle
        );
    }

    public function isLoanOfficer(User $user): bool
    {
        return $this->hasRoleSlug($user, 'loan-officer')
            || $this->primaryStaffRole($user) === 'loan_officer';
    }

    public function isCollector(User $user): bool
    {
        return $this->hasRoleSlug($user, 'collector')
            || $this->primaryStaffRole($user) === 'collector';
    }

    public function hasGlobalStaffAccess(User $user): bool
    {
        if ($user->hasPermission('users.manage') || $user->hasPermission('roles.manage') || $user->hasPermission('settings.manage') || $user->hasPermission('settings.view')) {
            return true;
        }

        if ($this->hasRoleSlug($user, 'super-admin')
            || $this->hasRoleSlug($user, 'admin')
            || $this->hasRoleSlug($user, 'admin-staff')) {
            return true;
        }

        return false;
    }

    /**
     * Collectors and global admins see org-wide data.
     * Loan officers (without collector/admin) see assigned portfolio + application queue.
     */
    public function shouldScopeToAssignedLoans(User $user): bool
    {
        if ($this->hasGlobalStaffAccess($user) || $this->isCollector($user)) {
            return false;
        }

        return $this->isLoanOfficer($user);
    }

    public function applyAssignedLoanScope(Builder $query, User $user): Builder
    {
        if ($this->shouldScopeToAssignedLoans($user)) {
            $query->where(function (Builder $scope) use ($user): void {
                $scope->where('assigned_officer_id', $user->id)
                    ->orWhereIn('status', [Loan::STATUS_PENDING, Loan::STATUS_PRE_APPROVED]);
            });
        }

        return $query;
    }

    public function applyAssignedLoanScopeViaRelation(Builder $query, User $user, string $loanRelation = 'loan'): Builder
    {
        if ($this->shouldScopeToAssignedLoans($user)) {
            $query->whereHas($loanRelation, function (Builder $loanQuery) use ($user): void {
                $loanQuery->where(function (Builder $scope) use ($user): void {
                    $scope->where('assigned_officer_id', $user->id)
                        ->orWhereIn('status', [Loan::STATUS_PENDING, Loan::STATUS_PRE_APPROVED]);
                });
            });
        }

        return $query;
    }

    public function applyAssignedBorrowerScope(Builder $query, User $user): Builder
    {
        if ($this->shouldScopeToAssignedLoans($user)) {
            $query->where(function (Builder $outer) use ($user): void {
                $outer->whereHas('loans', function (Builder $loanQuery) use ($user): void {
                    $loanQuery->where(function (Builder $scope) use ($user): void {
                        $scope->where('assigned_officer_id', $user->id)
                            ->orWhereIn('status', [Loan::STATUS_PENDING, Loan::STATUS_PRE_APPROVED]);
                    });
                })->orWhereHas('loanApplications', function (Builder $appQuery): void {
                    $appQuery->whereIn('status', ['pending', 'partially-approved', 'pre-approved', 'pre_approved']);
                });
            });
        }

        return $query;
    }

    public function canAccessLoan(User $user, ?int $assignedOfficerId, ?string $status = null): bool
    {
        if (! $this->shouldScopeToAssignedLoans($user)) {
            return true;
        }

        $normalized = strtolower(str_replace('_', '-', (string) $status));
        if (in_array($normalized, [Loan::STATUS_PENDING, Loan::STATUS_PRE_APPROVED], true)) {
            return true;
        }

        return (int) $assignedOfficerId === (int) $user->id;
    }
}
