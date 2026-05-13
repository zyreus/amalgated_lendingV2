<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent maintenance: re-sync denormalized inbox columns after bulk imports or repairs.
 * Safe to run in production during low traffic (short row locks on support_conversations).
 */
class BackfillSupportConversationInboxSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

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
    }
}
