<?php

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (! Schema::hasColumn('loans', 'approved_principal')) {
                $table->decimal('approved_principal', 15, 2)->nullable()->after('requested_principal');
            }
            if (! Schema::hasColumn('loans', 'approval_notes')) {
                $table->text('approval_notes')->nullable()->after('admin_notes');
            }
            if (! Schema::hasColumn('loans', 'pre_approved_by')) {
                $table->foreignId('pre_approved_by')->nullable()->after('approved_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('loans', 'pre_approved_at')) {
                $table->timestamp('pre_approved_at')->nullable()->after('approved_at');
            }
            if (! Schema::hasColumn('loans', 'released_by')) {
                $table->foreignId('released_by')->nullable()->after('pre_approved_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('loans', 'approval_history')) {
                $table->json('approval_history')->nullable()->after('admin_override_logs');
            }
        });

        // Backfill approved_principal from principal for disbursed loans.
        DB::table('loans')
            ->whereNull('approved_principal')
            ->whereIn('status', ['ongoing', 'released', 'completed', 'approved'])
            ->update(['approved_principal' => DB::raw('principal')]);

        // Migrate legacy statuses to professional workflow labels.
        DB::table('loans')->where('status', 'pre-approved')->update(['status' => 'partially-approved']);
        DB::table('loans')->where('status', 'ongoing')->update(['status' => 'released']);
        DB::table('loan_applications')->where('status', 'pre-approved')->update(['status' => 'partially-approved']);

        // Copy pre-approval timestamps where final approval has not occurred yet.
        DB::table('loans')
            ->where('status', 'partially-approved')
            ->whereNotNull('approved_by')
            ->whereNull('pre_approved_by')
            ->update([
                'pre_approved_by' => DB::raw('approved_by'),
                'pre_approved_at' => DB::raw('approved_at'),
            ]);

        // Released loans: set released_by from approved_by when missing.
        DB::table('loans')
            ->where('status', 'released')
            ->whereNotNull('disbursed_at')
            ->whereNull('released_by')
            ->whereNotNull('approved_by')
            ->update(['released_by' => DB::raw('approved_by')]);

        if (! Schema::hasTable('co_makers')) {
            Schema::create('co_makers', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_application_id')->constrained('loan_applications')->cascadeOnDelete();
                $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
                $table->string('full_name');
                $table->text('address')->nullable();
                $table->string('contact_number', 64)->nullable();
                $table->string('email')->nullable();
                $table->string('relationship_to_borrower', 120)->nullable();
                $table->string('occupation', 160)->nullable();
                $table->string('employer_business_name', 255)->nullable();
                $table->decimal('monthly_income', 15, 2)->nullable();
                $table->string('valid_id_type', 80)->nullable();
                $table->string('valid_id_number', 80)->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['loan_application_id', 'sort_order']);
            });
        }

        // Migrate legacy single co-maker fields from loan_applications.
        $legacyRows = DB::table('loan_applications')
            ->where(function ($q) {
                $q->whereNotNull('co_maker_name')
                    ->orWhereNotNull('co_maker_email')
                    ->orWhereNotNull('co_maker_phone');
            })
            ->get(['id', 'loan_id', 'co_maker_name', 'co_maker_email', 'co_maker_phone']);

        foreach ($legacyRows as $row) {
            $exists = DB::table('co_makers')->where('loan_application_id', $row->id)->exists();
            if ($exists) {
                continue;
            }
            $name = trim((string) ($row->co_maker_name ?? ''));
            if ($name === '') {
                $name = trim((string) ($row->co_maker_email ?? 'Co-Maker'));
            }
            if ($name === '') {
                continue;
            }
            DB::table('co_makers')->insert([
                'loan_application_id' => $row->id,
                'loan_id' => $row->loan_id,
                'full_name' => $name,
                'email' => $row->co_maker_email,
                'contact_number' => $row->co_maker_phone,
                'sort_order' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('loan_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_documents', 'loan_id')) {
                $table->foreignId('loan_id')->nullable()->after('loan_application_id')->constrained('loans')->nullOnDelete();
            }
            if (! Schema::hasColumn('loan_documents', 'co_maker_id')) {
                $table->foreignId('co_maker_id')->nullable()->after('loan_id')->constrained('co_makers')->nullOnDelete();
            }
            if (! Schema::hasColumn('loan_documents', 'document_category')) {
                $table->string('document_category', 80)->nullable()->after('document_type')->index();
            }
            if (! Schema::hasColumn('loan_documents', 'file_size')) {
                $table->unsignedBigInteger('file_size')->nullable()->after('original_name');
            }
            if (! Schema::hasColumn('loan_documents', 'mime_type')) {
                $table->string('mime_type', 120)->nullable()->after('file_size');
            }
            if (! Schema::hasColumn('loan_documents', 'uploaded_by')) {
                $table->foreignId('uploaded_by')->nullable()->after('mime_type')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('loan_documents', 'uploaded_at')) {
                $table->timestamp('uploaded_at')->nullable()->after('uploaded_by');
            }
        });

        // Backfill loan_id on loan_documents from linked loan_applications.
        DB::statement('
            UPDATE loan_documents ld
            INNER JOIN loan_applications la ON la.id = ld.loan_application_id
            SET ld.loan_id = la.loan_id
            WHERE ld.loan_id IS NULL AND la.loan_id IS NOT NULL
        ');

        $permissionDefs = [
            ['name' => 'View loan documents', 'slug' => 'documents.view', 'group_name' => 'Documents'],
            ['name' => 'Upload loan documents', 'slug' => 'documents.upload', 'group_name' => 'Documents'],
            ['name' => 'Replace loan documents', 'slug' => 'documents.replace', 'group_name' => 'Documents'],
            ['name' => 'Delete loan documents', 'slug' => 'documents.delete', 'group_name' => 'Documents'],
            ['name' => 'Approve loan documents', 'slug' => 'documents.approve', 'group_name' => 'Documents'],
            ['name' => 'Override approved loan amount', 'slug' => 'loans.approve_amount_override', 'group_name' => 'Loans'],
            ['name' => 'Manage co-makers', 'slug' => 'loans.comakers.manage', 'group_name' => 'Loans'],
        ];

        $permIds = [];
        foreach ($permissionDefs as $def) {
            $p = Permission::updateOrCreate(
                ['slug' => $def['slug']],
                ['name' => $def['name'], 'group_name' => $def['group_name']]
            );
            $permIds[] = $p->id;
        }

        $super = Role::query()->where('slug', 'super-admin')->first();
        if ($super) {
            $super->permissions()->syncWithoutDetaching($permIds);
        }

        $officerSlugs = ['documents.view', 'documents.upload', 'documents.replace', 'documents.delete', 'loans.comakers.manage'];
        $officer = Role::query()->where('slug', 'loan-officer')->first();
        if ($officer) {
            $officer->permissions()->syncWithoutDetaching(
                Permission::whereIn('slug', $officerSlugs)->pluck('id')->all()
            );
        }

        // Manager role (create if missing for document approve).
        $manager = Role::updateOrCreate(
            ['slug' => 'manager'],
            ['name' => 'Manager', 'description' => 'Loan management oversight with document approval.']
        );
        $manager->permissions()->syncWithoutDetaching(
            Permission::whereIn('slug', array_merge($officerSlugs, [
                'documents.approve', 'loans.approve', 'loans.view', 'loans.assign', 'dashboard.view', 'borrowers.view', 'reports.view',
            ]))->pluck('id')->all()
        );
    }

    public function down(): void
    {
        Permission::query()->whereIn('slug', [
            'documents.view', 'documents.upload', 'documents.replace', 'documents.delete',
            'documents.approve', 'loans.approve_amount_override', 'loans.comakers.manage',
        ])->delete();

        Schema::table('loan_documents', function (Blueprint $table) {
            foreach (['uploaded_at', 'uploaded_by', 'mime_type', 'file_size', 'document_category'] as $col) {
                if (Schema::hasColumn('loan_documents', $col)) {
                    $table->dropColumn($col);
                }
            }
            if (Schema::hasColumn('loan_documents', 'co_maker_id')) {
                $table->dropForeign(['co_maker_id']);
                $table->dropColumn('co_maker_id');
            }
            if (Schema::hasColumn('loan_documents', 'loan_id')) {
                $table->dropForeign(['loan_id']);
                $table->dropColumn('loan_id');
            }
        });

        Schema::dropIfExists('co_makers');

        DB::table('loans')->where('status', 'partially-approved')->update(['status' => 'pre-approved']);
        DB::table('loans')->where('status', 'released')->update(['status' => 'ongoing']);
        DB::table('loan_applications')->where('status', 'partially-approved')->update(['status' => 'pre-approved']);

        Schema::table('loans', function (Blueprint $table) {
            foreach (['approval_history', 'released_by', 'pre_approved_at', 'pre_approved_by', 'approval_notes', 'approved_principal'] as $col) {
                if (! Schema::hasColumn('loans', $col)) {
                    continue;
                }
                if (in_array($col, ['released_by', 'pre_approved_by'], true)) {
                    $table->dropForeign([$col]);
                }
                $table->dropColumn($col);
            }
        });
    }
};
