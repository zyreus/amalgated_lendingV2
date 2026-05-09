<?php

namespace App\Console\Commands;

use App\Models\LoanApplication;
use App\Models\User;
use App\Support\PublicStorageUrl;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Normalizes stored file path strings in the database (full URLs, Windows paths, etc.)
 * to relative public-disk paths. Run with --dry-run first.
 */
class RepairPublicDiskDatabasePaths extends Command
{
    protected $signature = 'lending:repair-public-disk-paths
                            {--dry-run : Show changes without saving}
                            {--fix : Apply updates (opposite of dry-run when set explicitly)}';

    protected $description = 'Normalize public disk file paths in the database (legacy URLs → relative paths).';

    public function handle(): int
    {
        $dryRun = ! $this->option('fix');
        if ($this->option('dry-run')) {
            $dryRun = true;
        }

        if ($dryRun) {
            $this->warn('Dry run — no database writes. Pass --fix to apply changes.');
        }

        $updated = 0;

        if (Schema::hasTable('users')) {
            User::query()->orderBy('id')->chunk(100, function ($users) use ($dryRun, &$updated) {
                foreach ($users as $user) {
                    foreach (['id_document_path', 'profile_photo_path'] as $col) {
                        $raw = $user->{$col};
                        if (! is_string($raw) || $raw === '') {
                            continue;
                        }
                        $norm = PublicStorageUrl::normalizeStoredPath($raw);
                        if ($norm !== null && $norm !== $raw) {
                            $this->line("users.{$col} #{$user->id}: ".substr($raw, 0, 80).'… → '.$norm);
                            if (! $dryRun) {
                                $user->{$col} = $norm;
                                $user->save();
                            }
                            $updated++;
                        }
                    }
                }
            });
        }

        if (Schema::hasTable('loan_applications')) {
            LoanApplication::query()->orderBy('id')->chunk(50, function ($apps) use ($dryRun, &$updated) {
                foreach ($apps as $app) {
                    foreach (['applicant_signature', 'spouse_signature', 'comaker_signature'] as $col) {
                        $raw = $app->{$col};
                        if (! is_string($raw) || $raw === '') {
                            continue;
                        }
                        $norm = PublicStorageUrl::normalizeStoredPath($raw);
                        if ($norm !== null && $norm !== $raw) {
                            $this->line("loan_applications.{$col} #{$app->id}: normalized");
                            if (! $dryRun) {
                                $app->{$col} = $norm;
                                $app->save();
                            }
                            $updated++;
                        }
                    }
                }
            });
        }

        if (Schema::hasTable('payments')) {
            $rows = DB::table('payments')->whereNotNull('receipt_path')->get();
            foreach ($rows as $row) {
                $raw = $row->receipt_path;
                if (! is_string($raw) || $raw === '') {
                    continue;
                }
                $norm = PublicStorageUrl::normalizeStoredPath($raw);
                if ($norm !== null && $norm !== $raw) {
                    $this->line("payments.receipt_path #{$row->id}");
                    if (! $dryRun) {
                        DB::table('payments')->where('id', $row->id)->update(['receipt_path' => $norm]);
                    }
                    $updated++;
                }
            }
        }

        $this->info($dryRun ? "Would update {$updated} path(s)." : "Updated {$updated} path(s).");
        $this->comment('Ensure `php artisan storage:link` and files exist under storage/app/public/.');

        return self::SUCCESS;
    }
}
