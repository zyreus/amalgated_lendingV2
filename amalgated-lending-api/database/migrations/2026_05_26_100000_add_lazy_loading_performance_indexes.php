<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->addIndex('loans', ['assigned_officer_id', 'status', 'id'], 'loans_officer_status_id_idx');
        $this->addIndex('loans', ['approved_by', 'status', 'id'], 'loans_approved_by_status_id_idx');
        $this->addIndex('payments', ['status', 'due_date', 'id'], 'payments_status_due_id_idx');
        $this->addIndex('payments', ['paid_at', 'status', 'id'], 'payments_paid_status_id_idx');
        $this->addIndex('portal_conversations', ['is_pinned', 'last_message_at', 'id'], 'portal_conv_pinned_last_id_idx');
        $this->addIndex('portal_messages', ['portal_conversation_id', 'sent_at', 'id'], 'portal_messages_conv_sent_id_idx');
        $this->addIndex('support_tickets', ['priority', 'last_reply_at', 'id'], 'support_tickets_priority_reply_id_idx');
        $this->addIndex('support_ticket_messages', ['support_ticket_id', 'sent_at', 'id'], 'support_ticket_messages_ticket_sent_id_idx');
        $this->addIndex('support_ticket_notes', ['support_ticket_id', 'created_at', 'id'], 'support_ticket_notes_ticket_created_id_idx');
        $this->addIndex('leads', ['loan_type', 'last_message_at', 'id'], 'leads_type_last_id_idx');
        $this->addIndex('leads', ['status', 'last_message_at', 'id'], 'leads_status_last_id_idx');
        $this->addIndex('borrower_notifications', ['user_id', 'archived_at', 'created_at', 'id'], 'borrower_notif_user_archive_created_idx');
        $this->addIndex('activity_logs', ['created_at', 'id'], 'activity_logs_created_id_idx');
    }

    public function down(): void
    {
        $this->dropIndex('activity_logs', 'activity_logs_created_id_idx');
        $this->dropIndex('borrower_notifications', 'borrower_notif_user_archive_created_idx');
        $this->dropIndex('leads', 'leads_status_last_id_idx');
        $this->dropIndex('leads', 'leads_type_last_id_idx');
        $this->dropIndex('support_ticket_notes', 'support_ticket_notes_ticket_created_id_idx');
        $this->dropIndex('support_ticket_messages', 'support_ticket_messages_ticket_sent_id_idx');
        $this->dropIndex('support_tickets', 'support_tickets_priority_reply_id_idx');
        $this->dropIndex('portal_messages', 'portal_messages_conv_sent_id_idx');
        $this->dropIndex('portal_conversations', 'portal_conv_pinned_last_id_idx');
        $this->dropIndex('payments', 'payments_paid_status_id_idx');
        $this->dropIndex('payments', 'payments_status_due_id_idx');
        $this->dropIndex('loans', 'loans_approved_by_status_id_idx');
        $this->dropIndex('loans', 'loans_officer_status_id_idx');
    }

    /**
     * Guard every index because this branch already contains several performance migrations.
     *
     * @param  array<int, string>  $columns
     */
    private function addIndex(string $table, array $columns, string $name): void
    {
        if (! Schema::hasTable($table) || $this->hasIndex($table, $name)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        Schema::table($table, function (Blueprint $blueprint) use ($columns, $name): void {
            $blueprint->index($columns, $name);
        });
    }

    private function dropIndex(string $table, string $name): void
    {
        if (! Schema::hasTable($table) || ! $this->hasIndex($table, $name)) {
            return;
        }

        Schema::table($table, function (Blueprint $blueprint) use ($name): void {
            $blueprint->dropIndex($name);
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            return ! empty(DB::select(
                'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
                [$table, $indexName],
            ));
        }

        if ($driver === 'pgsql') {
            return ! empty(DB::select(
                'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName],
            ));
        }

        if ($driver === 'sqlite') {
            return ! empty(DB::select(
                "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1",
                [$indexName],
            ));
        }

        return false;
    }
};
