<?php

namespace App\Policies;

use App\Models\Message;
use App\Models\User;

class MessagePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function view(User $user, Message $message): bool
    {
        return $user->canAccessAdminPortal() && (int) $message->chat?->owner_user_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }
}
