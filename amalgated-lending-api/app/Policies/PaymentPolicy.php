<?php

namespace App\Policies;

use App\Models\Payment;
use App\Models\User;

class PaymentPolicy
{
    public function viewAny(User $user): bool
    {
        if (! $user->canAccessAdminPortal()) {
            return false;
        }

        return $user->hasPermission('payments.manage')
            || $user->hasPermission('payments.verify')
            || $user->hasPermission('payments.export');
    }

    public function view(User $user, Payment $payment): bool
    {
        return $this->viewAny($user);
    }

    public function update(User $user, Payment $payment): bool
    {
        if (! $user->hasPermission('payments.manage')) {
            return false;
        }

        if ($payment->isPaid() && ! $this->canOverrideLocked($user)) {
            return false;
        }

        return true;
    }

    public function verify(User $user, Payment $payment): bool
    {
        return $user->hasPermission('payments.verify');
    }

    private function canOverrideLocked(User $user): bool
    {
        return $user->hasPermission('payments.override_locked') || $user->hasPermission('roles.manage');
    }
}
