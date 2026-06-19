<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Standardize support conversation lifecycle: ai_active | human_assisted | closed | archived
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        DB::table('support_conversations')
            ->whereIn('status', ['open', 'in_progress', ''])
            ->where(function ($q) {
                $q->where('ai_enabled', true)->orWhereNull('ai_enabled');
            })
            ->where('mode', '!=', 'human')
            ->update(['status' => 'ai_active', 'ai_enabled' => true, 'mode' => 'ai']);

        DB::table('support_conversations')
            ->where('status', 'resolved')
            ->update(['status' => 'closed']);

        DB::table('support_conversations')
            ->where(function ($q) {
                $q->where('status', 'human_assisted')
                    ->orWhere('mode', 'human')
                    ->orWhere('ai_enabled', false);
            })
            ->whereNotIn('status', ['closed', 'archived'])
            ->update(['status' => 'human_assisted', 'ai_enabled' => false, 'mode' => 'human']);
    }

    public function down(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        DB::table('support_conversations')->where('status', 'ai_active')->update(['status' => 'open']);
        DB::table('support_conversations')->where('status', 'closed')->update(['status' => 'resolved']);
    }
};
