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
            if (! Schema::hasColumn('loans', 'requested_principal')) {
                $table->decimal('requested_principal', 15, 2)->nullable()->after('principal');
            }
        });

        Schema::table('loan_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_applications', 'approved_amount')) {
                $table->decimal('approved_amount', 15, 2)->nullable()->after('loan_amount');
            }
        });

        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'is_final_payment')) {
                $table->boolean('is_final_payment')->default(false)->after('installment_no');
            }
            if (! Schema::hasColumn('payments', 'original_amount_due')) {
                $table->decimal('original_amount_due', 15, 2)->nullable()->after('amount_due');
            }
            if (! Schema::hasColumn('payments', 'adjusted_by')) {
                $table->foreignId('adjusted_by')->nullable()->after('notes')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'adjustment_reason')) {
                $table->text('adjustment_reason')->nullable()->after('adjusted_by');
            }
            if (! Schema::hasColumn('payments', 'adjusted_at')) {
                $table->timestamp('adjusted_at')->nullable()->after('adjustment_reason');
            }
        });

        if (! Schema::hasTable('payment_adjustment_audits')) {
            Schema::create('payment_adjustment_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
                $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
                $table->decimal('previous_amount_due', 15, 2);
                $table->decimal('new_amount_due', 15, 2);
                $table->foreignId('admin_user_id')->constrained('users')->restrictOnDelete();
                $table->text('reason');
                $table->timestamp('created_at')->useCurrent();
            });
        }

        // Backfill requested principal from current principal (legacy rows).
        DB::table('loans')->whereNull('requested_principal')->update([
            'requested_principal' => DB::raw('principal'),
        ]);

        // Mark final installments (highest installment_no per loan).
        $loanTerms = DB::table('loans')->select('id', 'term_months')->get();
        foreach ($loanTerms as $row) {
            $tid = (int) $row->id;
            $term = max(1, (int) $row->term_months);
            DB::table('payments')
                ->where('loan_id', $tid)
                ->where('installment_no', $term)
                ->update(['is_final_payment' => true]);
        }

        // Mirror approved amount from linked loan principal where application already approved.
        $approvedApps = DB::table('loan_applications')
            ->where('status', 'approved')
            ->whereNotNull('loan_id')
            ->whereNull('approved_amount')
            ->get(['id', 'loan_id']);
        foreach ($approvedApps as $row) {
            $principal = DB::table('loans')->where('id', $row->loan_id)->value('principal');
            if ($principal !== null) {
                DB::table('loan_applications')->where('id', $row->id)->update([
                    'approved_amount' => $principal,
                ]);
            }
        }

        $p = Permission::updateOrCreate(
            ['slug' => 'payments.adjust_final'],
            ['name' => 'Adjust final loan payment', 'group_name' => 'Payments']
        );
        $role = Role::query()->where('slug', 'super-admin')->first();
        if ($role) {
            $role->permissions()->syncWithoutDetaching([$p->id]);
        }
    }

    public function down(): void
    {
        Permission::query()->where('slug', 'payments.adjust_final')->delete();

        Schema::dropIfExists('payment_adjustment_audits');

        Schema::table('payments', function (Blueprint $table) {
            foreach (['adjusted_at', 'adjustment_reason', 'adjusted_by', 'original_amount_due', 'is_final_payment'] as $col) {
                if (Schema::hasColumn('payments', $col)) {
                    if ($col === 'adjusted_by') {
                        $table->dropForeign(['adjusted_by']);
                    }
                    $table->dropColumn($col);
                }
            }
        });

        Schema::table('loan_applications', function (Blueprint $table) {
            if (Schema::hasColumn('loan_applications', 'approved_amount')) {
                $table->dropColumn('approved_amount');
            }
        });

        Schema::table('loans', function (Blueprint $table) {
            if (Schema::hasColumn('loans', 'requested_principal')) {
                $table->dropColumn('requested_principal');
            }
        });
    }
};
