<?php

namespace App\Services;

/**
 * Reads admin-configured notification toggles and template subjects from system_settings.
 */
class EmailSettingsService
{
    public function isEmailEnabled(): bool
    {
        $prefs = setting('notifications');

        return ! array_key_exists('email_enabled', $prefs) || (bool) $prefs['email_enabled'];
    }

    public function isAutoSendEnabled(): bool
    {
        $prefs = setting('notifications');

        return ! array_key_exists('auto_send', $prefs) || (bool) $prefs['auto_send'];
    }

    public function maySendTransactional(): bool
    {
        return $this->isEmailEnabled() && $this->isAutoSendEnabled();
    }

    public function templateSubject(string $key, string $default): string
    {
        $email = setting('email_settings');
        $field = 'template_'.$key.'_subject';
        $custom = isset($email[$field]) ? trim((string) $email[$field]) : '';

        return $custom !== '' ? $custom : $default;
    }

    public function frontendUrl(): string
    {
        return rtrim((string) config('app.frontend_url', 'http://localhost:5173'), '/');
    }

    public function adminUrl(string $path = ''): string
    {
        $base = $this->frontendUrl().'/admin';
        $path = ltrim($path, '/');

        return $path === '' ? $base : $base.'/'.$path;
    }

    public function borrowerPortalUrl(string $path = ''): string
    {
        $base = $this->frontendUrl().'/borrower';
        $path = ltrim($path, '/');

        return $path === '' ? $base : $base.'/'.$path;
    }
}
