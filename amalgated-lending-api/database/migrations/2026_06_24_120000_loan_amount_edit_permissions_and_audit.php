<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (! Schema::hasColumn('loans', 'amount_modified_by')) {
                $table->foreignId('amount_modified_by')->nullable()->after('approval_history')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('loans', 'amount_modified_at')) {
                $table->timestamp('amount_modified_at')->nullable()->after('amount_modified_by');
            }
        });

        $perm = Permission::updateOrCreate(
            ['slug' => 'loans.edit_amount'],
            ['name' => 'Edit loan amount', 'group_name' => 'Loans']
        );

        $super = Role::query()->where('slug', 'super-admin')->first();
        if ($super) {
            $super->permissions()->syncWithoutDetaching([$perm->id]);
        }

        $officer = Role::query()->where('slug', 'loan-officer')->first();
        if ($officer) {
            $officer->permissions()->syncWithoutDetaching([$perm->id]);
        }

        $manager = Role::query()->where('slug', 'manager')->first();
        if ($manager) {
            $manager->permissions()->syncWithoutDetaching([$perm->id]);
        }
    }

    public function down(): void
    {
        Permission::query()->where('slug', 'loans.edit_amount')->delete();

        Schema::table('loans', function (Blueprint $table) {
            if (Schema::hasColumn('loans', 'amount_modified_by')) {
                $table->dropForeign(['amount_modified_by']);
                $table->dropColumn('amount_modified_by');
            }
            if (Schema::hasColumn('loans', 'amount_modified_at')) {
                $table->dropColumn('amount_modified_at');
            }
        });
    }
};
