<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_chat_feedback')) {
            return;
        }

        Schema::table('support_chat_feedback', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_chat_feedback', 'subject')) {
                $table->string('subject', 191)->nullable()->after('email');
            }
            if (! Schema::hasColumn('support_chat_feedback', 'status')) {
                $table->string('status', 24)->default('new')->after('comment')->index();
            }
            if (! Schema::hasColumn('support_chat_feedback', 'read_at')) {
                $table->timestamp('read_at')->nullable()->after('status');
            }
            if (! Schema::hasColumn('support_chat_feedback', 'replied_at')) {
                $table->timestamp('replied_at')->nullable()->after('read_at');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_chat_feedback')) {
            return;
        }

        Schema::table('support_chat_feedback', function (Blueprint $table): void {
            foreach (['replied_at', 'read_at', 'status', 'subject'] as $column) {
                if (Schema::hasColumn('support_chat_feedback', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
