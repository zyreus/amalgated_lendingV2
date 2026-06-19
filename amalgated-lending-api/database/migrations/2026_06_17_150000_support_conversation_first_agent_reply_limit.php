<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            if (! Schema::hasColumn('support_conversations', 'visitor_message_count')) {
                $table->unsignedSmallInteger('visitor_message_count')->default(0)->after('last_staff_message_at');
            }
            if (! Schema::hasColumn('support_conversations', 'visitor_chat_locked')) {
                $table->boolean('visitor_chat_locked')->default(false)->after('visitor_message_count');
            }
            if (! Schema::hasColumn('support_conversations', 'first_agent_response_received')) {
                $table->boolean('first_agent_response_received')->default(false)->after('visitor_chat_locked');
            }
            if (! Schema::hasColumn('support_conversations', 'first_agent_response_at')) {
                $table->timestamp('first_agent_response_at')->nullable()->after('first_agent_response_received');
            }
        });

        if (Schema::hasColumn('support_conversations', 'consecutive_visitor_messages')) {
            DB::table('support_conversations')->update([
                'visitor_message_count' => DB::raw('COALESCE(consecutive_visitor_messages, visitor_message_count, 0)'),
            ]);
        }
        if (Schema::hasColumn('support_conversations', 'visitor_send_locked')) {
            DB::table('support_conversations')->update([
                'visitor_chat_locked' => DB::raw('COALESCE(visitor_send_locked, visitor_chat_locked, 0)'),
            ]);
        }

        // Conversations that already have a staff reply are past the pre-first-reply limit.
        if (Schema::hasTable('chat_messages')) {
            $adminSessions = DB::table('chat_messages')
                ->where('sender_type', 'admin')
                ->orWhere('is_from_admin', true)
                ->distinct()
                ->pluck('session_id');

            if ($adminSessions->isNotEmpty()) {
                DB::table('support_conversations')
                    ->whereIn('session_id', $adminSessions)
                    ->update([
                        'first_agent_response_received' => true,
                        'visitor_chat_locked' => false,
                        'visitor_message_count' => 0,
                        'first_agent_response_at' => DB::raw('COALESCE(first_agent_response_at, updated_at, NOW())'),
                    ]);
            }
        }

        Schema::table('support_conversations', function (Blueprint $table) {
            foreach (['consecutive_visitor_messages', 'visitor_send_locked', 'visitor_locked_at'] as $col) {
                if (Schema::hasColumn('support_conversations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            if (! Schema::hasColumn('support_conversations', 'consecutive_visitor_messages')) {
                $table->unsignedSmallInteger('consecutive_visitor_messages')->default(0)->after('last_staff_message_at');
            }
            if (! Schema::hasColumn('support_conversations', 'visitor_send_locked')) {
                $table->boolean('visitor_send_locked')->default(false)->after('consecutive_visitor_messages');
            }
            if (! Schema::hasColumn('support_conversations', 'visitor_locked_at')) {
                $table->timestamp('visitor_locked_at')->nullable()->after('visitor_send_locked');
            }
        });

        if (Schema::hasColumn('support_conversations', 'visitor_message_count')) {
            DB::table('support_conversations')->update([
                'consecutive_visitor_messages' => DB::raw('visitor_message_count'),
                'visitor_send_locked' => DB::raw('visitor_chat_locked'),
            ]);
        }

        Schema::table('support_conversations', function (Blueprint $table) {
            foreach (['visitor_message_count', 'visitor_chat_locked', 'first_agent_response_received', 'first_agent_response_at'] as $col) {
                if (Schema::hasColumn('support_conversations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
