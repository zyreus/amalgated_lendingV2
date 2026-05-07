<?php

namespace App\Policies;

use App\Models\Contact;
use App\Models\User;

class ContactPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function view(User $user, Contact $contact): bool
    {
        return $user->canAccessAdminPortal() && (int) $contact->owner_user_id === (int) $user->id;
    }

    public function create(User $user): bool
    {
        return $user->canAccessAdminPortal();
    }

    public function update(User $user, Contact $contact): bool
    {
        return $this->view($user, $contact);
    }

    public function delete(User $user, Contact $contact): bool
    {
        return $this->view($user, $contact);
    }
}
