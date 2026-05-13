<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CRM chat / support warehouse — engagement timestamps for dashboards, SLA, and “last seen”.
 * Message-level delivery/read remains on `chat_messages` / `messages` (see enterprise migration).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_conversations', 'last_visitor_message_at')) {
                $table->timestamp('last_visitor_message_at')->nullable()->after('resolved_at')->index();
            }
            if (! Schema::hasColumn('support_conversations', 'last_staff_message_at')) {
                $table->timestamp('last_staff_message_at')->nullable()->after('last_visitor_message_at')->index();
            }
            if (! Schema::hasColumn('support_conversations', 'visitor_last_seen_at')) {
                $table->timestamp('visitor_last_seen_at')->nullable()->after('last_staff_message_at')->index();
            }
            if (! Schema::hasColumn('support_conversations', 'staff_last_seen_at')) {
                $table->timestamp('staff_last_seen_at')->nullable()->after('visitor_last_seen_at')->index();
            }
            if (! Schema::hasColumn('support_conversations', 'typing_last_at')) {
                $table->timestamp('typing_last_at')->nullable()->after('staff_last_seen_at');
            }
            if (! Schema::hasColumn('support_conversations', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('typing_last_at')->index();
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
                'archived_at',
                'typing_last_at',
                'staff_last_seen_at',
                'visitor_last_seen_at',
                'last_staff_message_at',
                'last_visitor_message_at',
            ] as $col) {
                if (Schema::hasColumn('support_conversations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
