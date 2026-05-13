<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CRM visitor / support warehouse — denormalized last activity + visitor lane for inbox UX.
 *
 * SQL performance notes (MySQL 8+):
 * - Composite (visitor_type, last_message_at) supports “AI vs human” filters sorted by recency.
 * - Keep COALESCE(sent_at, created_at) populated on chat_messages (see enterprise migration) so
 *   aggregates and this backfill stay index-friendly.
 * - For very large chat_messages tables, consider running the backfill UPDATE in batches by id range
 *   during a maintenance window to reduce lock duration; the PHP below is a single transaction-friendly pass.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_conversations', 'last_message_at')) {
                $table->timestamp('last_message_at')->nullable()->after('updated_at');
            }
            if (! Schema::hasColumn('support_conversations', 'visitor_type')) {
                $table->string('visitor_type', 8)->nullable()->after('mode');
            }
        });

        // Brownout-safe: never leave created_at / updated_at null if legacy rows exist.
        if (Schema::hasColumn('support_conversations', 'created_at')) {
            DB::table('support_conversations')
                ->whereNull('created_at')
                ->update(['created_at' => DB::raw('CURRENT_TIMESTAMP')]);
        }
        if (Schema::hasColumn('support_conversations', 'updated_at')) {
            DB::table('support_conversations')
                ->whereNull('updated_at')
                ->update(['updated_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
        }

        if (Schema::hasColumn('support_conversations', 'visitor_type')) {
            DB::table('support_conversations')->update([
                'visitor_type' => DB::raw("CASE WHEN LOWER(COALESCE(`mode`,'ai')) = 'human' THEN 'HUMAN' ELSE 'AI' END"),
            ]);
        }

        if (Schema::hasTable('chat_messages')
            && Schema::hasColumn('support_conversations', 'last_message_at')
            && Schema::hasColumn('chat_messages', 'support_conversation_id')) {
            $driver = Schema::getConnection()->getDriverName();
            if ($driver === 'mysql') {
                DB::statement('
                    UPDATE support_conversations sc
                    INNER JOIN (
                        SELECT support_conversation_id AS cid,
                               MAX(COALESCE(sent_at, created_at)) AS lm
                        FROM chat_messages
                        WHERE support_conversation_id IS NOT NULL
                          AND (is_feedback = 0 OR is_feedback IS NULL)
                        GROUP BY support_conversation_id
                    ) x ON x.cid = sc.id
                    SET sc.last_message_at = x.lm
                ');
            } else {
                // SQLite / others: correlated subquery
                DB::statement('
                    UPDATE support_conversations
                    SET last_message_at = (
                        SELECT MAX(COALESCE(cm.sent_at, cm.created_at))
                        FROM chat_messages cm
                        WHERE cm.support_conversation_id = support_conversations.id
                          AND (cm.is_feedback = 0 OR cm.is_feedback IS NULL)
                    )
                    WHERE EXISTS (
                        SELECT 1 FROM chat_messages cm2
                        WHERE cm2.support_conversation_id = support_conversations.id
                    )
                ');
            }
        }

        if (Schema::hasColumn('support_conversations', 'last_message_at')) {
            DB::table('support_conversations')
                ->whereNull('last_message_at')
                ->update(['last_message_at' => DB::raw('COALESCE(updated_at, created_at, CURRENT_TIMESTAMP)')]);
        }

        if (Schema::hasColumn('support_conversations', 'visitor_type')) {
            DB::table('support_conversations')
                ->whereNull('visitor_type')
                ->update(['visitor_type' => 'AI']);
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            if (Schema::hasColumn('support_conversations', 'last_message_at')) {
                try {
                    $table->index('last_message_at', 'support_conversations_last_message_at_idx');
                } catch (\Throwable) {
                }
            }
            if (Schema::hasColumn('support_conversations', 'visitor_type')) {
                try {
                    $table->index('visitor_type', 'support_conversations_visitor_type_idx');
                } catch (\Throwable) {
                }
            }
            if (Schema::hasColumn('support_conversations', 'visitor_type')
                && Schema::hasColumn('support_conversations', 'last_message_at')) {
                try {
                    $table->index(
                        ['visitor_type', 'last_message_at'],
                        'support_conversations_visitor_last_msg_idx',
                    );
                } catch (\Throwable) {
                }
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            foreach ([
                'support_conversations_visitor_last_msg_idx',
                'support_conversations_visitor_type_idx',
                'support_conversations_last_message_at_idx',
            ] as $idx) {
                try {
                    $table->dropIndex($idx);
                } catch (\Throwable) {
                }
            }
            if (Schema::hasColumn('support_conversations', 'last_message_at')) {
                $table->dropColumn('last_message_at');
            }
            if (Schema::hasColumn('support_conversations', 'visitor_type')) {
                $table->dropColumn('visitor_type');
            }
        });
    }
};
