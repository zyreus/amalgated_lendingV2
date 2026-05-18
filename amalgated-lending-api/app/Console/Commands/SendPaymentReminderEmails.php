<?php

namespace App\Console\Commands;

use App\Models\EmailLog;
use App\Models\Payment;
use App\Models\User;
use App\Services\EmailAutomationService;
use App\Services\EmailSettingsService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendPaymentReminderEmails extends Command
{
    protected $signature = 'emails:payment-reminders {--dry-run : List candidates without sending}';

    protected $description = 'Send upcoming and overdue payment reminder emails to borrowers';

    public function handle(EmailAutomationService $automation, EmailSettingsService $settings): int
    {
        if (! $settings->maySendTransactional()) {
            $this->warn('Email notifications are disabled in system settings.');

            return self::SUCCESS;
        }

        $dryRun = (bool) $this->option('dry-run');
        $reminderDays = (array) config('mail_automation.payment_reminder_days_before', [1, 3, 5]);
        $sent = 0;
        $skipped = 0;

        $pending = Payment::query()
            ->where('status', '!=', Payment::STATUS_PAID)
            ->whereNotNull('due_date')
            ->with(['loan.borrower'])
            ->get();

        $today = Carbon::now()->startOfDay();

        foreach ($pending as $payment) {
            $borrower = $payment->loan?->borrower;
            if (! $borrower instanceof User) {
                $skipped++;

                continue;
            }

            $email = trim((string) $borrower->email);
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $skipped++;

                continue;
            }

            $due = $payment->due_date->copy()->startOfDay();
            $days = $today->diffInDays($due, false);

            $variant = null;
            $daysOffset = 0;

            if ($days < 0 && config('mail_automation.payment_overdue_email_enabled', true)) {
                $variant = 'overdue';
                $daysOffset = $days;
            } elseif ($days >= 0 && in_array($days, $reminderDays, true)) {
                $variant = 'upcoming';
                $daysOffset = $days;
            }

            if ($variant === null) {
                continue;
            }

            $dedupeKey = 'payment_reminder:'.$payment->id.':'.$variant.':'.now()->toDateString();
            if (EmailLog::query()->where('dedupe_key', $dedupeKey)->where('status', EmailLog::STATUS_SENT)->exists()) {
                $skipped++;

                continue;
            }

            if ($dryRun) {
                $this->line("Would send {$variant} to {$email} (payment #{$payment->id}, days={$daysOffset})");
                $sent++;

                continue;
            }

            $result = $automation->sendPaymentReminderEmail($payment, $borrower, $variant, $daysOffset);
            if ($result['ok'] ?? false) {
                $payment->reminder_sent_at = now();
                $payment->saveQuietly();
                $sent++;
            } else {
                $this->warn("Failed payment #{$payment->id}: ".($result['detail'] ?? 'unknown'));
            }
        }

        $this->info("Payment reminder emails: sent={$sent}, skipped={$skipped}");

        return self::SUCCESS;
    }
}
