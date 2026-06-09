<?php

namespace App\Console;

use App\Console\Commands\CleanupAdminLogs;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        $schedule->command('chat:knowledge-sync')->dailyAt('02:15');
        $schedule->command('emails:payment-reminders')->dailyAt('08:00');
        $schedule->command('soa:generate-monthly --send')->monthlyOn(1, '06:00')->withoutOverlapping();
        $schedule->command('soa:recalculate-penalties')->dailyAt('05:30')->withoutOverlapping();
        $schedule->command('logs:cleanup')
            ->dailyAt('01:00')
            ->when(fn () => CleanupAdminLogs::shouldRunScheduled('daily'))
            ->withoutOverlapping();
        $schedule->command('logs:cleanup')
            ->weeklyOn(0, '1:00')
            ->when(fn () => CleanupAdminLogs::shouldRunScheduled('weekly'))
            ->withoutOverlapping();
        $schedule->command('logs:cleanup')
            ->monthlyOn(1, '01:00')
            ->when(fn () => CleanupAdminLogs::shouldRunScheduled('monthly'))
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
