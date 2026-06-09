<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'encoded_by')) {
                $table->foreignId('encoded_by')->nullable()->after('recorded_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'encoder_name')) {
                $table->string('encoder_name')->nullable()->after('encoded_by');
            }
            if (! Schema::hasColumn('payments', 'encoder_role')) {
                $table->string('encoder_role')->nullable()->after('encoder_name');
            }
            if (! Schema::hasColumn('payments', 'payment_type')) {
                $table->string('payment_type', 24)->nullable()->after('payment_method');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'encoded_by')) {
                $table->dropForeign(['encoded_by']);
            }

            foreach (['payment_type', 'encoder_role', 'encoder_name', 'encoded_by'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
