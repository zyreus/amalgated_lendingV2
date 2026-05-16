<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('activity_logs')) {
            Schema::table('activity_logs', function (Blueprint $table): void {
                if (! Schema::hasColumn('activity_logs', 'module')) {
                    $table->string('module', 96)->nullable()->after('action')->index();
                }
                if (! Schema::hasColumn('activity_logs', 'record_id')) {
                    $table->unsignedBigInteger('record_id')->nullable()->after('module')->index();
                }
            });
            Schema::table('activity_logs', function (Blueprint $table): void {
                if (
                    Schema::hasColumn('activity_logs', 'module')
                    && Schema::hasColumn('activity_logs', 'created_at')
                    && ! $this->hasIndex('activity_logs', 'activity_logs_module_created_idx')
                ) {
                    $table->index(['module', 'created_at'], 'activity_logs_module_created_idx');
                }
                if (
                    Schema::hasColumn('activity_logs', 'user_id')
                    && Schema::hasColumn('activity_logs', 'created_at')
                    && ! $this->hasIndex('activity_logs', 'activity_logs_user_created_idx')
                ) {
                    $table->index(['user_id', 'created_at'], 'activity_logs_user_created_idx');
                }
            });
        }

        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'timezone')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('timezone', 64)->nullable()->after('email');
            });
        }

        if (! Schema::hasTable('auth_security_events')) {
            Schema::create('auth_security_events', function (Blueprint $table): void {
                $table->id();
                $table->string('guard', 24)->index();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('event', 32)->index();
                $table->string('identifier', 191)->nullable()->index();
                $table->string('ip_address', 45)->nullable()->index();
                $table->string('user_agent', 512)->nullable();
                $table->json('metadata')->nullable();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['guard', 'event', 'created_at'], 'auth_security_guard_evt_created_idx');
            });
        }

        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table): void {
                if (! Schema::hasColumn('messages', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('metadata');
                }
                if (! Schema::hasColumn('messages', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
                if (! Schema::hasColumn('messages', 'read_at')) {
                    $table->timestamp('read_at')->nullable()->after('delivered_at');
                }
            });
            if (Schema::hasColumn('messages', 'sent_at')) {
                DB::table('messages')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
            Schema::table('messages', function (Blueprint $table): void {
                if (Schema::hasColumn('messages', 'sent_at') && ! $this->hasIndex('messages', 'messages_chat_sent_id_idx')) {
                    $table->index(['chat_id', 'sent_at', 'id'], 'messages_chat_sent_id_idx');
                }
                if (Schema::hasColumn('messages', 'read_at') && ! $this->hasIndex('messages', 'messages_chat_read_idx')) {
                    $table->index(['chat_id', 'read_at'], 'messages_chat_read_idx');
                }
            });
        }

        if (Schema::hasTable('chat_messages')) {
            Schema::table('chat_messages', function (Blueprint $table): void {
                if (! Schema::hasColumn('chat_messages', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('meta');
                }
                if (! Schema::hasColumn('chat_messages', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
                if (! Schema::hasColumn('chat_messages', 'read_at')) {
                    $table->timestamp('read_at')->nullable()->after('delivered_at');
                }
            });
            if (Schema::hasColumn('chat_messages', 'sent_at')) {
                DB::table('chat_messages')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
            Schema::table('chat_messages', function (Blueprint $table): void {
                if (Schema::hasColumn('chat_messages', 'sent_at') && ! $this->hasIndex('chat_messages', 'chat_messages_sess_sent_id_idx')) {
                    $table->index(['session_id', 'sent_at', 'id'], 'chat_messages_sess_sent_id_idx');
                }
                if (Schema::hasColumn('chat_messages', 'delivered_at') && ! $this->hasIndex('chat_messages', 'chat_messages_sess_deliv_idx')) {
                    $table->index(['session_id', 'delivered_at'], 'chat_messages_sess_deliv_idx');
                }
                if (Schema::hasColumn('chat_messages', 'read_at') && ! $this->hasIndex('chat_messages', 'chat_messages_sess_read_idx')) {
                    $table->index(['session_id', 'read_at'], 'chat_messages_sess_read_idx');
                }
            });
        }

        if (Schema::hasTable('lead_messages')) {
            Schema::table('lead_messages', function (Blueprint $table): void {
                if (! Schema::hasColumn('lead_messages', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('attachment_name');
                }
                if (! Schema::hasColumn('lead_messages', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
                if (! Schema::hasColumn('lead_messages', 'read_at')) {
                    $table->timestamp('read_at')->nullable()->after('delivered_at');
                }
            });
            if (Schema::hasColumn('lead_messages', 'sent_at')) {
                DB::table('lead_messages')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
            Schema::table('lead_messages', function (Blueprint $table): void {
                if (
                    Schema::hasColumn('lead_messages', 'lead_id')
                    && Schema::hasColumn('lead_messages', 'sent_at')
                    && ! $this->hasIndex('lead_messages', 'lead_messages_lead_sent_id_idx')
                ) {
                    $table->index(['lead_id', 'sent_at', 'id'], 'lead_messages_lead_sent_id_idx');
                }
            });
        }

        if (Schema::hasTable('loans') && ! Schema::hasColumn('loans', 'rejected_at')) {
            Schema::table('loans', function (Blueprint $table): void {
                $table->timestamp('rejected_at')->nullable()->after('approved_at')->index();
            });
            if (Schema::hasColumn('loans', 'rejected_at')) {
                DB::table('loans')
                    ->where('status', 'rejected')
                    ->whereNull('rejected_at')
                    ->update(['rejected_at' => DB::raw('COALESCE(updated_at, created_at)')]);
            }
        }

        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table): void {
                if (! Schema::hasColumn('payments', 'reminder_sent_at')) {
                    $column = $table->timestamp('reminder_sent_at')->nullable();
                    if (Schema::hasColumn('payments', 'paid_at')) {
                        $column->after('paid_at');
                    }
                    $column->index();
                }
                if (! Schema::hasColumn('payments', 'rejected_at')) {
                    $column = $table->timestamp('rejected_at')->nullable();
                    if (Schema::hasColumn('payments', 'approved_at')) {
                        $column->after('approved_at');
                    } elseif (Schema::hasColumn('payments', 'verified_at')) {
                        $column->after('verified_at');
                    } elseif (Schema::hasColumn('payments', 'paid_at')) {
                        $column->after('paid_at');
                    }
                    $column->index();
                }
            });
        }

        if (Schema::hasTable('admin_notifications')) {
            Schema::table('admin_notifications', function (Blueprint $table): void {
                if (! Schema::hasColumn('admin_notifications', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('delivery_channels');
                }
                if (! Schema::hasColumn('admin_notifications', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
            });
            if (Schema::hasColumn('admin_notifications', 'sent_at')) {
                DB::table('admin_notifications')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
        }

        if (Schema::hasTable('borrower_notifications')) {
            Schema::table('borrower_notifications', function (Blueprint $table): void {
                if (! Schema::hasColumn('borrower_notifications', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('delivery_channels');
                }
                if (! Schema::hasColumn('borrower_notifications', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
            });
            if (Schema::hasColumn('borrower_notifications', 'sent_at')) {
                DB::table('borrower_notifications')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
        }

        if (Schema::hasTable('notification_delivery_logs')) {
            Schema::table('notification_delivery_logs', function (Blueprint $table): void {
                if (! Schema::hasColumn('notification_delivery_logs', 'sent_at')) {
                    $table->timestamp('sent_at')->nullable()->after('meta');
                }
                if (! Schema::hasColumn('notification_delivery_logs', 'delivered_at')) {
                    $table->timestamp('delivered_at')->nullable()->after('sent_at');
                }
            });
            if (Schema::hasColumn('notification_delivery_logs', 'sent_at')) {
                DB::table('notification_delivery_logs')->whereNull('sent_at')->update(['sent_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
            }
            Schema::table('notification_delivery_logs', function (Blueprint $table): void {
                if (
                    Schema::hasColumn('notification_delivery_logs', 'delivered_at')
                    && ! $this->hasIndex('notification_delivery_logs', 'notif_deliv_logs_status_deliv_idx')
                ) {
                    $table->index(['status', 'delivered_at'], 'notif_deliv_logs_status_deliv_idx');
                }
            });
        }
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $rows = DB::select(
                'SELECT 1 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
                 LIMIT 1',
                [$table, $indexName],
            );

            return ! empty($rows);
        }

        if ($driver === 'pgsql') {
            $rows = DB::select(
                'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName],
            );

            return ! empty($rows);
        }

        if ($driver === 'sqlite') {
            $rows = DB::select(
                "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1",
                [$indexName],
            );

            return ! empty($rows);
        }

        return false;
    }

    public function down(): void
    {
        if (Schema::hasTable('notification_delivery_logs')) {
            Schema::table('notification_delivery_logs', function (Blueprint $table): void {
                foreach (['notif_deliv_logs_status_deliv_idx'] as $idx) {
                    try {
                        $table->dropIndex($idx);
                    } catch (\Throwable) {
                    }
                }
                foreach (['delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('notification_delivery_logs', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('borrower_notifications')) {
            Schema::table('borrower_notifications', function (Blueprint $table): void {
                foreach (['delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('borrower_notifications', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('admin_notifications')) {
            Schema::table('admin_notifications', function (Blueprint $table): void {
                foreach (['delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('admin_notifications', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table): void {
                foreach (['rejected_at', 'reminder_sent_at'] as $col) {
                    if (Schema::hasColumn('payments', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('loans') && Schema::hasColumn('loans', 'rejected_at')) {
            Schema::table('loans', function (Blueprint $table): void {
                $table->dropColumn('rejected_at');
            });
        }

        if (Schema::hasTable('lead_messages')) {
            Schema::table('lead_messages', function (Blueprint $table): void {
                try {
                    $table->dropIndex('lead_messages_lead_sent_id_idx');
                } catch (\Throwable) {
                }
                foreach (['read_at', 'delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('lead_messages', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('chat_messages')) {
            Schema::table('chat_messages', function (Blueprint $table): void {
                foreach (['chat_messages_sess_read_idx', 'chat_messages_sess_deliv_idx', 'chat_messages_sess_sent_id_idx'] as $idx) {
                    try {
                        $table->dropIndex($idx);
                    } catch (\Throwable) {
                    }
                }
                foreach (['read_at', 'delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('chat_messages', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table): void {
                foreach (['messages_chat_read_idx', 'messages_chat_sent_id_idx'] as $idx) {
                    try {
                        $table->dropIndex($idx);
                    } catch (\Throwable) {
                    }
                }
                foreach (['read_at', 'delivered_at', 'sent_at'] as $col) {
                    if (Schema::hasColumn('messages', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        Schema::dropIfExists('auth_security_events');

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'timezone')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('timezone');
            });
        }

        if (Schema::hasTable('activity_logs')) {
            Schema::table('activity_logs', function (Blueprint $table): void {
                foreach (['activity_logs_user_created_idx', 'activity_logs_module_created_idx'] as $idx) {
                    try {
                        $table->dropIndex($idx);
                    } catch (\Throwable) {
                    }
                }
                foreach (['record_id', 'module'] as $col) {
                    if (Schema::hasColumn('activity_logs', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
