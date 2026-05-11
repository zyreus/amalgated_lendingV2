<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Speeds up EXISTS subqueries used for overdue-loan counts on the admin dashboard
 * (`payments` filtered by loan_id + status + due_date).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->index(['loan_id', 'status', 'due_date'], 'payments_loan_id_status_due_date_index');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_loan_id_status_due_date_index');
        });
    }
};
