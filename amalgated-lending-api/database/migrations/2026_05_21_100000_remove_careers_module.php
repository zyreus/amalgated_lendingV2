<?php

use App\Models\AdminNavigationItem;
use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        AdminNavigationItem::query()->whereIn('path', [
            '/admin/careers',
            '/admin/careers/jobs',
            '/admin/careers/applications',
        ])->delete();

        $permIds = Permission::query()->whereIn('slug', ['careers.view', 'careers.manage'])->pluck('id');
        if ($permIds->isNotEmpty()) {
            DB::table('permission_role')->whereIn('permission_id', $permIds->all())->delete();
            Permission::query()->whereIn('id', $permIds->all())->delete();
        }

        $hr = Role::query()->where('slug', 'hr-manager')->first();
        if ($hr) {
            $hr->users()->detach();
            $hr->permissions()->detach();
            $hr->delete();
        }

        Schema::dropIfExists('careers_email_logs');
        Schema::dropIfExists('careers_interviews');
        Schema::dropIfExists('careers_applications');
        Schema::dropIfExists('careers_applicants');
        Schema::dropIfExists('careers_jobs');
        Schema::dropIfExists('careers_branches');
        Schema::dropIfExists('careers_departments');
    }

    public function down(): void
    {
        // Intentionally empty — careers module removed from the product.
    }
};
