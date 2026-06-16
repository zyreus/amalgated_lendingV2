<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (
            Schema::hasTable('borrower_profiles')
            && Schema::hasColumn('borrower_profiles', 'phone_number')
            && ! $this->hasIndex('borrower_profiles', 'borrower_profiles_phone_number_idx')
        ) {
            Schema::table('borrower_profiles', function (Blueprint $table): void {
                $table->index('phone_number', 'borrower_profiles_phone_number_idx');
            });
        }
    }

    public function down(): void
    {
        if (
            Schema::hasTable('borrower_profiles')
            && $this->hasIndex('borrower_profiles', 'borrower_profiles_phone_number_idx')
        ) {
            Schema::table('borrower_profiles', function (Blueprint $table): void {
                $table->dropIndex('borrower_profiles_phone_number_idx');
            });
        }
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            return ! empty(DB::select(
                'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
                [$table, $indexName],
            ));
        }

        if ($driver === 'pgsql') {
            return ! empty(DB::select(
                'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName],
            ));
        }

        if ($driver === 'sqlite') {
            return ! empty(DB::select(
                "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1",
                [$indexName],
            ));
        }

        return false;
    }
};
