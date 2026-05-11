<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM / visitor chat paths: conversation inbox aggregates, analytics ranges, lead inbox.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('chat_messages')) {
            Schema::table('chat_messages', function (Blueprint $table) {
                $table->index(['is_feedback', 'session_id', 'id'], 'chat_messages_fb_session_id_idx');
            });
        }

        if (Schema::hasTable('support_conversations')) {
            Schema::table('support_conversations', function (Blueprint $table) {
                $table->index(['created_at', 'status'], 'support_conv_created_status_idx');
                $table->index(['status', 'needs_human'], 'support_conv_status_human_idx');
            });
        }

        if (Schema::hasTable('support_chat_feedback')) {
            Schema::table('support_chat_feedback', function (Blueprint $table) {
                $table->index(['created_at'], 'support_feedback_created_idx');
            });
        }

        if (Schema::hasTable('leads')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->index(['status', 'last_message_at'], 'leads_status_last_msg_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('chat_messages')) {
            Schema::table('chat_messages', function (Blueprint $table) {
                $table->dropIndex('chat_messages_fb_session_id_idx');
            });
        }

        if (Schema::hasTable('support_conversations')) {
            Schema::table('support_conversations', function (Blueprint $table) {
                $table->dropIndex('support_conv_created_status_idx');
                $table->dropIndex('support_conv_status_human_idx');
            });
        }

        if (Schema::hasTable('support_chat_feedback')) {
            Schema::table('support_chat_feedback', function (Blueprint $table) {
                $table->dropIndex('support_feedback_created_idx');
            });
        }

        if (Schema::hasTable('leads')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropIndex('leads_status_last_msg_idx');
            });
        }
    }
};
