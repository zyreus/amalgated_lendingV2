<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Backfill warehouse status for threads where a human agent has taken over.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        DB::table('support_conversations')
            ->where(function ($q) {
                $q->where('mode', 'human')
                    ->orWhere('ai_enabled', false)
                    ->orWhereNotNull('human_takeover_at');
            })
            ->whereNotIn('status', ['resolved', 'archived'])
            ->update(['status' => 'human_assisted']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        DB::table('support_conversations')
            ->where('status', 'human_assisted')
            ->update(['status' => 'in_progress']);
    }
};
