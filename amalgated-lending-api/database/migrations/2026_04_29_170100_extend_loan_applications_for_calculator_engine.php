<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_applications', 'loan_product_id')) {
                $table->foreignId('loan_product_id')
                    ->nullable()
                    ->after('loan_id')
                    ->constrained('loan_products')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('loan_applications', 'loan_amount')) {
                $table->decimal('loan_amount', 15, 2)->nullable()->after('loan_type');
            }
            if (! Schema::hasColumn('loan_applications', 'term_months')) {
                $table->unsignedSmallInteger('term_months')->nullable()->after('loan_amount');
            }
            if (! Schema::hasColumn('loan_applications', 'computed_values')) {
                $table->json('computed_values')->nullable()->after('documents');
            }
            if (! Schema::hasColumn('loan_applications', 'computation_breakdown')) {
                $table->json('computation_breakdown')->nullable()->after('computed_values');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loan_applications', function (Blueprint $table) {
            if (Schema::hasColumn('loan_applications', 'loan_product_id')) {
                $table->dropConstrainedForeignId('loan_product_id');
            }
            $drops = [];
            if (Schema::hasColumn('loan_applications', 'loan_amount')) {
                $drops[] = 'loan_amount';
            }
            if (Schema::hasColumn('loan_applications', 'term_months')) {
                $drops[] = 'term_months';
            }
            if (Schema::hasColumn('loan_applications', 'computed_values')) {
                $drops[] = 'computed_values';
            }
            if (Schema::hasColumn('loan_applications', 'computation_breakdown')) {
                $drops[] = 'computation_breakdown';
            }
            if ($drops !== []) {
                $table->dropColumn($drops);
            }
        });
    }
};
