<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
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
    }

    public function down(): void
    {
        Schema::table('support_conversations', function (Blueprint $table) {
            $cols = ['consecutive_visitor_messages', 'visitor_send_locked', 'visitor_locked_at'];
            foreach ($cols as $col) {
                if (Schema::hasColumn('support_conversations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
