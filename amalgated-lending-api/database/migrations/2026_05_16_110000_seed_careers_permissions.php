<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $view = Permission::updateOrCreate(
            ['slug' => 'careers.view'],
            ['name' => 'View careers (HR dashboard, jobs, applicants)', 'group_name' => 'Careers']
        );
        $manage = Permission::updateOrCreate(
            ['slug' => 'careers.manage'],
            ['name' => 'Manage careers (postings, pipeline, interviews, exports)', 'group_name' => 'Careers']
        );

        $super = Role::query()->where('slug', 'super-admin')->first();
        if ($super) {
            $super->permissions()->syncWithoutDetaching([$view->id, $manage->id]);
        }
    }

    public function down(): void
    {
        Permission::query()->whereIn('slug', ['careers.view', 'careers.manage'])->delete();
    }
};
