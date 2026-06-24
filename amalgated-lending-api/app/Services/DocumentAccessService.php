<?php

namespace App\Services;

use App\Models\User;

/**
 * Role-based document permissions (borrower upload/view only; staff tiers per business rules).
 */
class DocumentAccessService
{
    public function canView(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return true;
        }

        return $user->hasPermission('documents.view')
            || $user->hasPermission('loans.view')
            || $user->canAccessAdminPortal();
    }

    public function canUpload(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return true;
        }

        return $user->hasPermission('documents.upload')
            || $user->hasPermission('loans.approve')
            || $user->canAccessAdminPortal();
    }

    public function canReplace(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return false;
        }

        return $user->hasPermission('documents.replace')
            || $user->hasPermission('loans.approve')
            || $user->canAccessAdminPortal();
    }

    public function canDelete(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return false;
        }

        return $user->hasPermission('documents.delete')
            || $user->hasPermission('loans.approve')
            || $user->canAccessAdminPortal();
    }

    public function canApprove(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return false;
        }

        return $user->hasPermission('documents.approve')
            || $user->hasPermission('loans.approve')
            || $user->roles()->where('slug', 'manager')->exists()
            || $user->roles()->where('slug', 'super-admin')->exists();
    }

    /** @return array<string, bool> */
    public function permissionsFor(User $user): array
    {
        return [
            'view' => $this->canView($user),
            'upload' => $this->canUpload($user),
            'replace' => $this->canReplace($user),
            'delete' => $this->canDelete($user),
            'approve' => $this->canApprove($user),
        ];
    }
}
