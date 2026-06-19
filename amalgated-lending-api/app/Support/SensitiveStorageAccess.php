<?php

namespace App\Support;

use App\Models\DocumentLoanApplication;
use App\Models\LeadMessage;
use App\Models\LoanApplication;
use App\Models\User;

final class SensitiveStorageAccess
{
    public static function canRead(?User $user, string $normalizedPath): bool
    {
        if ($user === null) {
            return false;
        }

        if ($user->canAccessAdminPortal() && $user->hasPermission('borrowers.view')) {
            return true;
        }

        if (preg_match('#^borrower-documents/(\d+)/#', $normalizedPath, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        if (preg_match('#^borrower-selfies/(\d+)/#', $normalizedPath, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        if (preg_match('#^borrower-id-docs/(\d+)/#', $normalizedPath, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        if (preg_match('#^borrower-receipts/(\d+)/#', $normalizedPath, $m)) {
            return (int) $user->id === (int) $m[1];
        }

        if (preg_match('#^documents/(\d+)/([^/]+)/(.+)$#', $normalizedPath, $m)) {
            return LoanApplication::query()
                ->whereKey((int) $m[1])
                ->where('user_id', $user->id)
                ->exists();
        }

        if (preg_match('#^documents/(\d+)/([^/]+)$#', $normalizedPath, $m)) {
            if (DocumentLoanApplication::query()
                ->whereKey((int) $m[1])
                ->where('user_id', $user->id)
                ->exists()) {
                return true;
            }
        }

        if (preg_match('#^documents/document-applications/(\d+)/#', $normalizedPath, $m)) {
            return $user->canUseBorrowerPortal()
                && DocumentLoanApplication::query()
                    ->whereKey((int) $m[1])
                    ->where('user_id', $user->id)
                    ->exists();
        }

        if (preg_match('#^loan-applications/(\d+)/#', $normalizedPath, $m)) {
            return LoanApplication::query()
                ->whereKey((int) $m[1])
                ->where('user_id', $user->id)
                ->exists();
        }

        if (str_starts_with($normalizedPath, 'signatures/')) {
            return $user->canUseBorrowerPortal() || $user->canAccessAdminPortal();
        }

        if (str_starts_with($normalizedPath, 'lead-chat/')) {
            if ($user->canAccessAdminPortal() && $user->hasPermission('borrowers.view')) {
                return true;
            }

            if ($user->canUseBorrowerPortal()) {
                return LeadMessage::query()
                    ->where('attachment_path', $normalizedPath)
                    ->whereHas('lead', fn ($q) => $q->where('user_id', $user->id))
                    ->exists();
            }
        }

        return false;
    }
}
