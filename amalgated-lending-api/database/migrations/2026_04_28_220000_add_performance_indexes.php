<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->index(['loan_id', 'due_date'], 'payments_loan_due_idx');
            $table->index(['loan_id', 'status'], 'payments_loan_status_idx');
            $table->index(['paid_at'], 'payments_paid_at_idx');
        });

        Schema::table('loans', function (Blueprint $table) {
            $table->index(['borrower_id', 'id'], 'loans_borrower_id_idx');
            $table->index(['status', 'created_at'], 'loans_status_created_idx');
            $table->index(['status', 'disbursed_at'], 'loans_status_disbursed_idx');
        });

        Schema::table('admin_notifications', function (Blueprint $table) {
            $table->index(['read_at', 'created_at'], 'admin_notif_read_created_idx');
        });

        Schema::table('borrower_notifications', function (Blueprint $table) {
            $table->index(['user_id', 'read_at', 'created_at'], 'borrower_notif_user_read_created_idx');
        });

        Schema::table('lead_messages', function (Blueprint $table) {
            $table->index(['lead_id', 'id'], 'lead_messages_lead_id_id_idx');
        });

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->index(['session_id', 'id'], 'chat_messages_session_id_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropIndex('payments_loan_due_idx');
            $table->dropIndex('payments_loan_status_idx');
            $table->dropIndex('payments_paid_at_idx');
        });

        Schema::table('loans', function (Blueprint $table) {
            $table->dropIndex('loans_borrower_id_idx');
            $table->dropIndex('loans_status_created_idx');
            $table->dropIndex('loans_status_disbursed_idx');
        });

        Schema::table('admin_notifications', function (Blueprint $table) {
            $table->dropIndex('admin_notif_read_created_idx');
        });

        Schema::table('borrower_notifications', function (Blueprint $table) {
            $table->dropIndex('borrower_notif_user_read_created_idx');
        });

        Schema::table('lead_messages', function (Blueprint $table) {
            $table->dropIndex('lead_messages_lead_id_id_idx');
        });

        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropIndex('chat_messages_session_id_id_idx');
        });
    }
};
