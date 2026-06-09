<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('loans')) {
            return;
        }

        Schema::table('loans', function (Blueprint $table) {
            if (! $this->hasIndex('loans', 'loans_status_id_idx')) {
                $table->index(['status', 'id'], 'loans_status_id_idx');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('loans')) {
            return;
        }

        Schema::table('loans', function (Blueprint $table) {
            if ($this->hasIndex('loans', 'loans_status_id_idx')) {
                $table->dropIndex('loans_status_id_idx');
            }
        });
    }

    private function hasIndex(string $table, string $indexName): bool
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'mysql' || $driver === 'mariadb') {
            $rows = DB::select(
                'SELECT 1 FROM information_schema.statistics
                 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
                 LIMIT 1',
                [$table, $indexName],
            );

            return ! empty($rows);
        }

        if ($driver === 'pgsql') {
            $rows = DB::select(
                'SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ? LIMIT 1',
                [$table, $indexName],
            );

            return ! empty($rows);
        }

        if ($driver === 'sqlite') {
            $rows = DB::select(
                "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ? LIMIT 1",
                [$indexName],
            );

            return ! empty($rows);
        }

        return false;
    }
};
