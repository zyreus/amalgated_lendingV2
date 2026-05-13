<?php

namespace App\Policies;

use App\Models\SupportConversation;
use App\Models\User;

class SupportConversationPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function view(User $user, SupportConversation $supportConversation): bool
    {
        return $user->canAccessAdminPortal();
    }
}
