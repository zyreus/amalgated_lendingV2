<?php

namespace App\Console\Commands;

use App\Support\AuthRateLimit;
use Illuminate\Console\Command;
use Illuminate\Http\Request;

class ClearAuthThrottleCommand extends Command
{
    protected $signature = 'auth:clear-throttle
        {--username= : Clear lockouts for this username (with --ip)}
        {--ip= : Client IP address (defaults to 127.0.0.1 when clearing all for an IP)}
        {--all : Clear all known auth throttle buckets for the given --username and/or --ip}';

    protected $description = 'Clear login / OTP / password-reset rate limiter lockouts for troubleshooting.';

    public function handle(): int
    {
        $username = $this->option('username') ? mb_strtolower(trim((string) $this->option('username'))) : null;
        $ip = trim((string) ($this->option('ip') ?: ($username ? '127.0.0.1' : '')));

        if (! $this->option('all') && ! $username && $ip === '') {
            $this->error('Provide --username, --ip, or --all.');

            return self::FAILURE;
        }

        $request = Request::create('/api/v1/admin/login', 'POST', [
            'username' => $username ?? '',
        ]);
        $request->server->set('REMOTE_ADDR', $ip !== '' ? $ip : '127.0.0.1');

        if ($this->option('all')) {
            AuthRateLimit::clearAllFor($request, $username);
            $this->info('Cleared all auth throttle buckets for '.($username ? "username {$username} " : '')."IP {$request->ip()}.");

            return self::SUCCESS;
        }

        if ($username) {
            AuthRateLimit::clearAdminLogin($request, $username);
            AuthRateLimit::clearBorrowerLogin($request, $username);
            AuthRateLimit::clearOtpVerify($request, $username);
            AuthRateLimit::clearPasswordReset($request, $username);
            $this->info("Cleared login throttles for username \"{$username}\" at IP {$request->ip()}.");
        }

        if ($ip !== '' && ! $username) {
            AuthRateLimit::clearAllFor($request, null);
            $this->info("Cleared legacy IP-only auth throttles for {$ip}.");
        }

        return self::SUCCESS;
    }
}
