<?php

use App\Services\SupportConversationHandoffService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            return;
        }

        DB::table('support_conversations')
            ->whereIn('status', ['open', 'in_progress'])
            ->where(function ($q) {
                $q->where('ai_enabled', true)->orWhereNull('ai_enabled');
            })
            ->whereNull('assigned_to')
            ->where(function ($q) {
                $q->where('mode', 'ai')->orWhereNull('mode');
            })
            ->update([
                'status' => SupportConversationHandoffService::STATUS_AI_ACTIVE,
                'mode' => 'ai',
                'ai_enabled' => true,
            ]);
    }

    public function down(): void
    {
        // Non-reversible data normalization.
    }
};
