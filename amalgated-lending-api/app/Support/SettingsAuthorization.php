<?php

namespace App\Support;

use App\Models\User;

class SettingsAuthorization
{
    /** @var array<string, string> */
    public const KEY_PERMISSIONS = [
        'company' => 'settings.general.manage',
        'locale' => 'settings.general.manage',
        'branding' => 'settings.documents.manage',
        'loan_defaults' => 'settings.loans.manage',
        'loan_configuration' => 'settings.loans.manage',
        'interest_settings' => 'settings.loans.manage',
        'collection_settings' => 'settings.collections.manage',
        'payment_settings' => 'settings.financial.manage',
        'notifications' => 'settings.communication.manage',
        'email_settings' => 'settings.communication.manage',
        'website_chat' => 'settings.communication.manage',
        'credit_scoring' => 'settings.operations.manage',
        'reports' => 'settings.operations.manage',
        'integrations' => 'settings.operations.manage',
        'security' => 'settings.security.manage',
        'audit' => 'settings.security.manage',
        'system' => 'settings.system.manage',
        'log_cleanup' => 'settings.system.manage',
    ];

    public static function canView(User $user): bool
    {
        if ($user->hasPermission('settings.manage') || $user->hasPermission('settings.view')) {
            return true;
        }

        foreach (self::KEY_PERMISSIONS as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    public static function canManageKey(User $user, string $key): bool
    {
        if ($user->hasPermission('settings.manage')) {
            return true;
        }

        $permission = self::KEY_PERMISSIONS[$key] ?? null;

        return $permission && $user->hasPermission($permission);
    }

    public static function permissionForKey(string $key): ?string
    {
        return self::KEY_PERMISSIONS[$key] ?? null;
    }
}
