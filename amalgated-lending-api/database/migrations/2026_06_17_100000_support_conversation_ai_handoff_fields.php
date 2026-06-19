<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Explicit AI handoff flags for support / visitor chat (CRM warehouse).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            if (! Schema::hasColumn('support_conversations', 'ai_enabled')) {
                $table->boolean('ai_enabled')->default(true)->after('mode');
            }
            if (! Schema::hasColumn('support_conversations', 'human_takeover_at')) {
                $table->timestamp('human_takeover_at')->nullable()->after('assigned_to');
            }
        });

        // Backfill from legacy `mode` column.
        if (Schema::hasColumn('support_conversations', 'ai_enabled')) {
            DB::table('support_conversations')
                ->where('mode', 'human')
                ->update(['ai_enabled' => false]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        Schema::table('support_conversations', function (Blueprint $table): void {
            foreach (['ai_enabled', 'human_takeover_at'] as $col) {
                if (Schema::hasColumn('support_conversations', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
