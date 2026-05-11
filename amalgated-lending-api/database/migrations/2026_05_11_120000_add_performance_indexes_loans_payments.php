<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Speeds up borrower dashboards (payments by loan + due order) and related lookups.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            $table->index(['borrower_id', 'id'], 'loans_borrower_id_id_index');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->index(['loan_id', 'due_date'], 'payments_loan_id_due_date_index');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_loan_id_due_date_index');
        });

        Schema::table('loans', function (Blueprint $table) {
            $table->dropIndex('loans_borrower_id_id_index');
        });
    }
};
