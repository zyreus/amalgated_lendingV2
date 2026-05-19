<?php

namespace App\Providers;

use App\Models\ChatMessage;
use App\Models\Message;
use App\Models\Payment;
use App\Observers\ChatMessageObserver;
use App\Observers\MessageObserver;
use App\Observers\PaymentObserver;
use App\Services\ActivityLogger;
use App\Services\AuthSecurityRecorder;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        $this->app->bind(ActivityLogger::class, function ($app) {
            return new ActivityLogger($app['request']);
        });

        $this->app->bind(AuthSecurityRecorder::class, function ($app) {
            return new AuthSecurityRecorder($app['request']);
        });
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        $this->normalizeMailConfig();

        $appUrl = (string) config('app.url', '');
        if ($appUrl !== '') {
            URL::forceRootUrl(rtrim($appUrl, '/'));
        }

        if (app()->environment('production') || ($appUrl !== '' && str_starts_with($appUrl, 'https://'))) {
            URL::forceScheme('https');
        }

        ResetPassword::createUrlUsing(function ($user, string $token) {
            $base = rtrim((string) Config::get('app.frontend_url', 'http://localhost:5173'), '/');

            return $base.'/reset-password?token='.urlencode($token).'&email='.urlencode($user->getEmailForPasswordReset());
        });

        Payment::observe(PaymentObserver::class);
        ChatMessage::observe(ChatMessageObserver::class);
        Message::observe(MessageObserver::class);
    }

    /** Trim Google App Passwords and normalize Gmail SMTP defaults. */
    private function normalizeMailConfig(): void
    {
        $password = config('mail.mailers.smtp.password');
        if (is_string($password)) {
            Config::set('mail.mailers.smtp.password', preg_replace('/\s+/', '', trim($password)) ?? '');
        }

        $username = config('mail.mailers.smtp.username');
        if (is_string($username)) {
            Config::set('mail.mailers.smtp.username', trim($username));
        }

        $ehlo = trim((string) config('mail.mailers.smtp.local_domain', ''));
        if ($ehlo === '' && is_string($username) && str_contains($username, '@')) {
            Config::set('mail.mailers.smtp.local_domain', substr(strrchr($username, '@'), 1) ?: null);
        }
    }
}
