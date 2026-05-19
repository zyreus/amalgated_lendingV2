<?php

namespace App\Console\Commands;

use App\Mail\SmtpTestMail;
use App\Services\EmailSettingsService;
use App\Services\SmtpMailService;
use App\Services\TransactionalMailSender;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class MailDiagnoseCommand extends Command
{
    protected $signature = 'mail:diagnose
        {--to= : Recipient for a live test message}
        {--skip-send : Only run SMTP handshake, do not send mail}';

    protected $description = 'Diagnose Google Workspace SMTP configuration, settings toggles, and optional test delivery';

    public function handle(SmtpMailService $smtp, EmailSettingsService $settings, TransactionalMailSender $sender): int
    {
        $this->info('Amalgated Lending — mail diagnostics');
        $this->newLine();

        $status = $smtp->status();
        $this->table(['Key', 'Value'], collect($status)->map(fn ($v, $k) => [$k, is_bool($v) ? ($v ? 'yes' : 'no') : (string) $v])->values());

        $this->line('Notification toggles: may_send='.($settings->maySendTransactional() ? 'yes' : 'no'));
        $this->newLine();

        $health = $smtp->healthCheck();
        if ($health['ok']) {
            $this->info('SMTP handshake: OK ('.($health['latency_ms'] ?? '?').' ms)');
        } else {
            $this->error('SMTP handshake failed: '.($health['message'] ?? 'unknown'));

            return self::FAILURE;
        }

        if ($this->option('skip-send')) {
            return self::SUCCESS;
        }

        $to = trim((string) ($this->option('to') ?: config('mail.mailers.smtp.username', '')));
        if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            $this->warn('No --to address; skipping live send. Use: php artisan mail:diagnose --to=you@example.com');

            return self::SUCCESS;
        }

        try {
            Mail::to($to)->send(new SmtpTestMail);
            $this->info('Live test message sent to '.$to.' via '.config('mail.default').'.');
        } catch (\Throwable $e) {
            $this->error('Live send failed: '.$e->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
