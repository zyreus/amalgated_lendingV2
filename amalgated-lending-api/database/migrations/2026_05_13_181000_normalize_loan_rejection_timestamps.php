<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('loans') || ! Schema::hasColumn('loans', 'rejected_at')) {
            return;
        }

        DB::table('loans')
            ->where('status', 'rejected')
            ->whereNotNull('approved_at')
            ->update([
                'rejected_at' => DB::raw('COALESCE(rejected_at, approved_at)'),
                'approved_at' => null,
            ]);
    }

    public function down(): void
    {
        // Irreversible data normalization.
    }
};
