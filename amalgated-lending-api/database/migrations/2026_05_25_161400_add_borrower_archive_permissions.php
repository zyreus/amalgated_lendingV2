<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $permissions = [
            ['name' => 'Archive borrowers', 'slug' => 'borrowers.archive', 'group_name' => 'Borrowers'],
            ['name' => 'Restore borrowers', 'slug' => 'borrowers.restore', 'group_name' => 'Borrowers'],
        ];

        $ids = [];
        foreach ($permissions as $permission) {
            $ids[] = Permission::query()->updateOrCreate(
                ['slug' => $permission['slug']],
                $permission
            )->id;
        }

        $superAdmin = Role::query()->where('slug', 'super-admin')->first();
        if ($superAdmin) {
            $superAdmin->permissions()->syncWithoutDetaching($ids);
        }
    }

    public function down(): void
    {
        $slugs = ['borrowers.archive', 'borrowers.restore'];

        Permission::query()
            ->whereIn('slug', $slugs)
            ->get()
            ->each(function (Permission $permission): void {
                $permission->roles()->detach();
                $permission->delete();
            });
    }
};
