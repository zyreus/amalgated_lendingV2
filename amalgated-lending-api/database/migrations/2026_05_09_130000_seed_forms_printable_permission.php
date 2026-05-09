<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $p = Permission::updateOrCreate(
            ['slug' => 'forms.printable.manage'],
            ['name' => 'Manage printable PDF forms', 'group_name' => 'Forms']
        );

        $role = Role::query()->where('slug', 'super-admin')->first();
        if ($role) {
            $role->permissions()->syncWithoutDetaching([$p->id]);
        }
    }

    public function down(): void
    {
        Permission::query()->where('slug', 'forms.printable.manage')->delete();
    }
};
