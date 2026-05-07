<?php

namespace App\Policies;

use App\Models\Chat;
use App\Models\User;

class ChatPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function view(User $user, Chat $chat): bool
    {
        return $user->canAccessAdminPortal() && (int) $chat->owner_user_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function update(User $user, Chat $chat): bool
    {
        return $this->view($user, $chat);
    }

    public function delete(User $user, Chat $chat): bool
    {
        return $this->view($user, $chat);
    }
}
