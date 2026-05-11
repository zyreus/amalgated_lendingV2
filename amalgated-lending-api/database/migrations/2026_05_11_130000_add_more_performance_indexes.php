<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Second-pass perf indexes to cover the remaining slow paths surfaced after
 * the dashboard / loan list / borrower portal optimization pass:
 *
 *   - `loan_applications` borrower-scoped lookups (BorrowerPortalController::lendingApplications,
 *     profileDocuments, BorrowerLoanApplicationWizardController::index).
 *   - Duplicate `reference_number` check on borrower payment uploads.
 *   - Bell-icon poll / unread-count for borrowers (already partially covered, this adds the
 *     missing `(user_id, archived_at, read_at)` plan).
 *
 * All `add` blocks are guarded so the migration is safe to re-run in
 * environments where prior partial migrations may already exist.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('loan_applications')) {
            Schema::table('loan_applications', function (Blueprint $table) {
                if (! $this->hasIndex('loan_applications', 'loan_apps_user_status_idx')) {
                    $table->index(['user_id', 'status'], 'loan_apps_user_status_idx');
                }
                if (! $this->hasIndex('loan_applications', 'loan_apps_user_type_id_idx')) {
                    $table->index(['user_id', 'loan_type', 'id'], 'loan_apps_user_type_id_idx');
                }
                if (
                    Schema::hasColumn('loan_applications', 'submitted_at')
                    && ! $this->hasIndex('loan_applications', 'loan_apps_submitted_at_idx')
                ) {
                    $table->index('submitted_at', 'loan_apps_submitted_at_idx');
                }
            });
        }

        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'reference_number')) {
            Schema::table('payments', function (Blueprint $table) {
                if (! $this->hasIndex('payments', 'payments_reference_number_idx')) {
                    $table->index('reference_number', 'payments_reference_number_idx');
                }
            });
        }

        if (Schema::hasTable('borrower_notifications')) {
            Schema::table('borrower_notifications', function (Blueprint $table) {
                if (! $this->hasIndex('borrower_notifications', 'borrower_notif_user_archived_read_idx')) {
                    $table->index(
                        ['user_id', 'archived_at', 'read_at'],
                        'borrower_notif_user_archived_read_idx',
                    );
                }
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'role')) {
            Schema::table('users', function (Blueprint $table) {
                if (! $this->hasIndex('users', 'users_role_idx')) {
                    $table->index('role', 'users_role_idx');
                }
            });
        }
    }

    public function down(): void
    {
        $drops = [
            'loan_applications' => [
                'loan_apps_user_status_idx',
                'loan_apps_user_type_id_idx',
                'loan_apps_submitted_at_idx',
            ],
            'payments' => ['payments_reference_number_idx'],
            'borrower_notifications' => ['borrower_notif_user_archived_read_idx'],
            'users' => ['users_role_idx'],
        ];

        foreach ($drops as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table, $indexes) {
                foreach ($indexes as $name) {
                    if ($this->hasIndex($table, $name)) {
                        $blueprint->dropIndex($name);
                    }
                }
            });
        }
    }

    /**
     * Cross-driver "does this index exist?" helper. Doctrine DBAL is no longer required by Laravel,
     * so we query INFORMATION_SCHEMA / sqlite_master directly instead of `Schema::getIndexes`.
     */
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

        // Fallback: try to add and rely on duplicate-index error in production.
        return false;
    }
};
