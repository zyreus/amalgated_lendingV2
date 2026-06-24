<?php

namespace App\Services;

class SecurityPolicyService
{
    public function __construct(private SettingsService $settings)
    {
    }

    /**
     * @return array<string, mixed>
     */
    public function securitySettings(): array
    {
        return $this->settings->get('security', [
            'two_factor_enabled' => false,
            'max_login_attempts' => 5,
            'session_timeout_minutes' => 60,
            'password_min_length' => 8,
        ]);
    }

    public function passwordMinLength(): int
    {
        $min = (int) ($this->securitySettings()['password_min_length'] ?? 8);

        return max(8, min(128, $min));
    }

    public function maxLoginAttempts(): int
    {
        $max = (int) ($this->securitySettings()['max_login_attempts'] ?? 5);

        return max(3, min(20, $max));
    }

    public function sessionTimeoutMinutes(): int
    {
        $minutes = (int) ($this->securitySettings()['session_timeout_minutes'] ?? 60);

        return max(5, min(1440, $minutes));
    }

    public function maintenanceModeEnabled(): bool
    {
        $system = $this->settings->get('system', []);

        return (bool) ($system['maintenance_mode'] ?? false);
    }
}
