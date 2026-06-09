<?php

namespace App\Console\Commands;

use App\Models\SystemSetting;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class CleanupAdminLogs extends Command
{
    protected $signature = 'logs:cleanup
        {--retention-days= : Override the configured retention period}
        {--optimize : Optimize cleaned tables after deletion}
        {--force : Run even when disabled in admin settings}';

    protected $description = 'Delete old admin activity, audit, login, and system event logs.';

    public function handle(): int
    {
        $settings = self::settings();

        if (! (bool) $settings['enabled'] && ! $this->option('force')) {
            $this->info('Admin log cleanup is disabled.');

            return self::SUCCESS;
        }

        $retentionDays = $this->retentionDays($settings);
        $cutoff = now()->subDays($retentionDays);
        $deletedCounts = [];
        $optimizedTables = [];

        foreach ($this->cleanupTables() as $table => $label) {
            if (! Schema::hasTable($table)) {
                $deletedCounts[$label] = 'table missing';
                continue;
            }

            if (! Schema::hasColumn($table, 'created_at')) {
                $deletedCounts[$label] = 'created_at missing';
                continue;
            }

            $deletedCounts[$label] = DB::table($table)
                ->where('created_at', '<', $cutoff)
                ->delete();

            if ($this->shouldOptimize($settings) && $this->optimizeTable($table)) {
                $optimizedTables[] = $table;
            }
        }

        $this->recordLastRun($settings, $retentionDays, $cutoff->toDateTimeString(), $deletedCounts, $optimizedTables);

        $this->table(
            ['Log type', 'Deleted rows'],
            collect($deletedCounts)->map(fn ($count, $label) => [$label, $count])->values()->all()
        );

        if ($optimizedTables !== []) {
            $this->info('Optimized tables: '.implode(', ', $optimizedTables));
        }

        $this->info("Old admin logs older than {$retentionDays} day(s) deleted successfully.");

        return self::SUCCESS;
    }

    public static function shouldRunScheduled(string $frequency): bool
    {
        $settings = self::settings();

        return (bool) $settings['enabled']
            && self::normalizeFrequency((string) $settings['frequency']) === self::normalizeFrequency($frequency);
    }

    public static function settings(): array
    {
        $defaults = self::defaultSettings();

        try {
            if (! Schema::hasTable('system_settings')) {
                return $defaults;
            }

            $value = SystemSetting::query()->where('key', 'log_cleanup')->value('value');

            return array_merge($defaults, is_array($value) ? $value : []);
        } catch (Throwable) {
            return $defaults;
        }
    }

    private static function defaultSettings(): array
    {
        return [
            'enabled' => true,
            'retention_days' => 30,
            'frequency' => 'weekly',
            'optimize_tables' => false,
        ];
    }

    private static function normalizeFrequency(string $frequency): string
    {
        return in_array($frequency, ['daily', 'weekly', 'monthly'], true) ? $frequency : 'weekly';
    }

    private function retentionDays(array $settings): int
    {
        $option = $this->option('retention-days');
        $days = $option !== null
            ? (int) $option
            : (int) ($settings['retention_days'] ?? self::defaultSettings()['retention_days']);

        return max(1, $days);
    }

    private function cleanupTables(): array
    {
        return [
            'activity_logs' => 'Admin activity logs',
            'admin_logs' => 'Admin logs',
            'audit_trails' => 'Audit trails',
            'login_histories' => 'Login histories',
            'system_event_logs' => 'System event logs',
            'auth_security_events' => 'Authentication security events',
        ];
    }

    private function shouldOptimize(array $settings): bool
    {
        return (bool) $this->option('optimize') || (bool) ($settings['optimize_tables'] ?? false);
    }

    private function optimizeTable(string $table): bool
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            return false;
        }

        DB::statement("OPTIMIZE TABLE `{$table}`");

        return true;
    }

    private function recordLastRun(array $settings, int $retentionDays, string $cutoff, array $deletedCounts, array $optimizedTables): void
    {
        if (! Schema::hasTable('system_settings')) {
            return;
        }

        SystemSetting::query()->updateOrCreate(
            ['key' => 'log_cleanup'],
            [
                'value' => array_merge($settings, [
                    'retention_days' => $retentionDays,
                    'last_run_at' => now()->toIso8601String(),
                    'last_cutoff_at' => $cutoff,
                    'last_deleted_counts' => $deletedCounts,
                    'last_optimized_tables' => $optimizedTables,
                ]),
            ]
        );
    }
}
