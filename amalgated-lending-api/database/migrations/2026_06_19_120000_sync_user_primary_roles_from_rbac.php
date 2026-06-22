<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        User::query()
            ->with('roles')
            ->whereHas('roles')
            ->chunkById(100, function ($users): void {
                foreach ($users as $user) {
                    $user->syncPrimaryRoleFromRoles();
                }
            });
    }

    public function down(): void
    {
        // Non-destructive data sync — no rollback.
    }
};
