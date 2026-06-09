<?php

use App\Models\Permission;
use App\Models\Role;
use App\Models\AdminNavigationItem;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soa_statements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
            $table->date('statement_month');
            $table->date('due_date');
            $table->decimal('monthly_due', 14, 2)->default(0);
            $table->decimal('penalties', 14, 2)->default(0);
            $table->decimal('remaining_balance', 14, 2)->default(0);
            $table->decimal('total_due', 14, 2)->default(0);
            $table->string('status', 32)->default('draft');
            $table->string('pdf_path')->nullable();
            $table->boolean('email_sent')->default(false);
            $table->timestamp('email_sent_at')->nullable();
            $table->timestamp('viewed_at')->nullable();
            $table->timestamp('downloaded_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('snapshot')->nullable();
            $table->timestamps();

            $table->unique(['loan_id', 'statement_month'], 'soa_loan_month_unique');
            $table->index(['borrower_id', 'statement_month']);
            $table->index(['status', 'due_date']);
            $table->index(['email_sent', 'email_sent_at']);
        });

        Schema::create('soa_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('soa_id')->constrained('soa_statements')->cascadeOnDelete();
            $table->string('action', 64);
            $table->text('description')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['soa_id', 'created_at']);
            $table->index('action');
        });

        Schema::table('email_logs', function (Blueprint $table): void {
            if (! Schema::hasColumn('email_logs', 'soa_id')) {
                $table->foreignId('soa_id')->nullable()->after('payment_id')->constrained('soa_statements')->nullOnDelete();
                $table->index(['soa_id', 'notification_type']);
            }
        });

        Permission::query()->updateOrCreate(
            ['slug' => 'soa.manage'],
            ['name' => 'Manage statements of account', 'group_name' => 'Statements']
        );
        Permission::query()->updateOrCreate(
            ['slug' => 'soa.view'],
            ['name' => 'View statements of account', 'group_name' => 'Statements']
        );
        $soaPermissionIds = Permission::query()->whereIn('slug', ['soa.manage', 'soa.view'])->pluck('id')->all();
        Role::query()->whereIn('slug', ['super-admin', 'loan-officer', 'accountant'])
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($soaPermissionIds));

        AdminNavigationItem::query()->updateOrCreate(
            ['path' => '/admin/soa'],
            [
                'label' => 'SOA Management',
                'icon_key' => 'report',
                'sort_order' => 66,
                'permission_slug' => 'soa.view',
                'match_end' => false,
            ]
        );
    }

    public function down(): void
    {
        Permission::query()->whereIn('slug', ['soa.manage', 'soa.view'])->delete();
        AdminNavigationItem::query()->where('path', '/admin/soa')->delete();

        Schema::table('email_logs', function (Blueprint $table): void {
            if (Schema::hasColumn('email_logs', 'soa_id')) {
                $table->dropConstrainedForeignId('soa_id');
            }
        });

        Schema::dropIfExists('soa_logs');
        Schema::dropIfExists('soa_statements');
    }
};
