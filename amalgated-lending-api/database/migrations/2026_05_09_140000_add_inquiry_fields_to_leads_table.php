<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            if (! Schema::hasColumn('leads', 'phone')) {
                $table->string('phone', 64)->nullable()->after('email')->index();
            }
            if (! Schema::hasColumn('leads', 'estimated_amount')) {
                $table->decimal('estimated_amount', 15, 2)->nullable()->after('loan_type');
            }
            if (! Schema::hasColumn('leads', 'source')) {
                $table->string('source', 120)->nullable()->after('estimated_amount')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            foreach (['source', 'estimated_amount', 'phone'] as $col) {
                if (Schema::hasColumn('leads', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
