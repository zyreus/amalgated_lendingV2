<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $archive = Permission::query()->where('slug', 'borrowers.archive')->first();
        if (! $archive) {
            return;
        }

        Role::query()
            ->whereIn('slug', ['loan-officer', 'collector', 'admin-staff', 'admin'])
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching([$archive->id]));
    }

    public function down(): void
    {
        $archive = Permission::query()->where('slug', 'borrowers.archive')->first();
        if (! $archive) {
            return;
        }

        Role::query()
            ->whereIn('slug', ['loan-officer', 'collector', 'admin-staff', 'admin'])
            ->get()
            ->each(fn (Role $role) => $role->permissions()->detach($archive->id));
    }
};
