<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (! Schema::hasColumn('loans', 'loan_computation_snapshot')) {
                $table->json('loan_computation_snapshot')->nullable()->after('application_payload');
            }
            if (! Schema::hasColumn('loans', 'admin_override_logs')) {
                $table->json('admin_override_logs')->nullable()->after('loan_computation_snapshot');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            foreach (['admin_override_logs', 'loan_computation_snapshot'] as $col) {
                if (Schema::hasColumn('loans', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
