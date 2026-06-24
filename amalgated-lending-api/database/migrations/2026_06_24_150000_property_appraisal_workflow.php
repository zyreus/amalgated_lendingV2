<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('real_estate_details')) {
            return;
        }

        Schema::table('real_estate_details', function (Blueprint $table) {
            if (! Schema::hasColumn('real_estate_details', 'property_description')) {
                $table->text('property_description')->nullable()->after('property_address');
            }
            if (! Schema::hasColumn('real_estate_details', 'appraised_value')) {
                $table->decimal('appraised_value', 15, 2)->nullable()->after('assessed_value');
            }
            if (! Schema::hasColumn('real_estate_details', 'loanable_percentage')) {
                $table->decimal('loanable_percentage', 5, 2)->nullable()->after('appraised_value');
            }
            if (! Schema::hasColumn('real_estate_details', 'loanable_value')) {
                $table->decimal('loanable_value', 15, 2)->nullable()->after('loanable_percentage');
            }
            if (! Schema::hasColumn('real_estate_details', 'evaluation_remarks')) {
                $table->text('evaluation_remarks')->nullable()->after('loanable_value');
            }
            if (! Schema::hasColumn('real_estate_details', 'evaluated_by')) {
                $table->foreignId('evaluated_by')->nullable()->after('evaluation_remarks')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('real_estate_details', 'evaluated_at')) {
                $table->timestamp('evaluated_at')->nullable()->after('evaluated_by');
            }
        });

        // Backfill appraised value from legacy borrower-entered market value.
        if (Schema::hasColumn('real_estate_details', 'appraised_value') && Schema::hasColumn('real_estate_details', 'market_value')) {
            DB::table('real_estate_details')
                ->whereNull('appraised_value')
                ->whereNotNull('market_value')
                ->where('market_value', '>', 0)
                ->update(['appraised_value' => DB::raw('market_value')]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('real_estate_details')) {
            return;
        }

        Schema::table('real_estate_details', function (Blueprint $table) {
            if (Schema::hasColumn('real_estate_details', 'evaluated_at')) {
                $table->dropColumn('evaluated_at');
            }
            if (Schema::hasColumn('real_estate_details', 'evaluated_by')) {
                $table->dropConstrainedForeignId('evaluated_by');
            }
            foreach (['evaluation_remarks', 'loanable_value', 'loanable_percentage', 'appraised_value', 'property_description'] as $col) {
                if (Schema::hasColumn('real_estate_details', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
