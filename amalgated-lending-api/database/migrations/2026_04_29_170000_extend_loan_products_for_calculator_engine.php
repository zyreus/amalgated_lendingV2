<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_products', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_products', 'code')) {
                $table->string('code', 40)->nullable()->after('slug')->index();
            }
            if (! Schema::hasColumn('loan_products', 'max_amount')) {
                $table->decimal('max_amount', 15, 2)->nullable()->after('max_term');
            }
            if (! Schema::hasColumn('loan_products', 'collateral_type')) {
                $table->string('collateral_type', 120)->nullable()->after('collateral');
            }
            if (! Schema::hasColumn('loan_products', 'rules')) {
                $table->json('rules')->nullable()->after('calculator_config');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loan_products', function (Blueprint $table) {
            $drops = [];
            if (Schema::hasColumn('loan_products', 'code')) {
                $drops[] = 'code';
            }
            if (Schema::hasColumn('loan_products', 'max_amount')) {
                $drops[] = 'max_amount';
            }
            if (Schema::hasColumn('loan_products', 'collateral_type')) {
                $drops[] = 'collateral_type';
            }
            if (Schema::hasColumn('loan_products', 'rules')) {
                $drops[] = 'rules';
            }
            if ($drops !== []) {
                $table->dropColumn($drops);
            }
        });
    }
};
