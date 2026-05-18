<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Facades\Log;

/**
 * Sends Google Workspace email alerts to admin staff for in-app admin notifications.
 */
class StaffEmailNotifier
{
    public function __construct(
        private readonly EmailAutomationService $automation,
        private readonly EmailSettingsService $settings,
    ) {}

    public function dispatchForAdminNotification(AdminNotification $notification): void
    {
        if (! $this->settings->maySendTransactional()) {
            return;
        }

        $recipients = $this->resolveRecipients();
        if ($recipients === []) {
            return;
        }

        $data = is_array($notification->data) ? $notification->data : [];
        $adminPath = $this->resolveAdminPath($notification->category, $data);

        foreach ($recipients as $row) {
            $email = $row['email'];
            $dedupeKey = 'staff_alert:'.$notification->id.':'.md5(mb_strtolower($email));

            try {
                $this->automation->sendStaffAlert(
                    $email,
                    $row['name'],
                    (string) $notification->title,
                    $notification->body,
                    (string) $notification->category,
                    $adminPath,
                    $data,
                    $dedupeKey,
                );
            } catch (\Throwable $e) {
                Log::warning('Staff alert email failed.', [
                    'notification_id' => $notification->id,
                    'email' => $email,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * @return array<int, array{email: string, name: string}>
     */
    private function resolveRecipients(): array
    {
        $out = [];
        $seen = [];

        $staff = User::query()
            ->where('is_active', true)
            ->whereNotNull('email')
            ->get(['id', 'name', 'email', 'role']);

        foreach ($staff as $user) {
            if (! $user->canAccessAdminPortal()) {
                continue;
            }
            $email = mb_strtolower(trim((string) $user->email));
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL) || isset($seen[$email])) {
                continue;
            }

            $pref = NotificationPreference::query()->where('user_id', $user->id)->first();
            if ($pref && ! $pref->email) {
                continue;
            }

            $seen[$email] = true;
            $out[] = ['email' => $email, 'name' => (string) $user->name];
        }

        if ($out !== []) {
            return $out;
        }

        foreach ((array) config('mail_automation.staff_alert_emails', []) as $email) {
            $email = mb_strtolower(trim((string) $email));
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL) || isset($seen[$email])) {
                continue;
            }
            $seen[$email] = true;
            $out[] = ['email' => $email, 'name' => 'Admin Team'];
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function resolveAdminPath(string $category, array $data): string
    {
        if (isset($data['lead_id'])) {
            return 'chat?lead='.(int) $data['lead_id'];
        }
        if (isset($data['loan_id'])) {
            return 'loans/'.(int) $data['loan_id'];
        }
        if (isset($data['payment_id'])) {
            return 'payments';
        }

        return match ($category) {
            NotificationCenter::CATEGORY_CRM_INQUIRY => 'chat',
            NotificationCenter::CATEGORY_PAYMENT_RECEIVED,
            NotificationCenter::CATEGORY_PAYMENT_OVERDUE => 'payments',
            default => '',
        };
    }
}
