<?php

namespace App\Services;

use App\Models\AdminNotification;
use App\Models\AdminNotificationRead;
use App\Models\BorrowerNotification;
use App\Models\FailedNotification;
use App\Models\NotificationDeliveryLog;
use App\Models\NotificationPreference;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Central entry point for in-app (and logged) notifications across borrowers and staff.
 * Email/SMS for many flows remain in dedicated mailable jobs; this service records in-app
 * delivery and respects per-user channel preferences.
 */
class NotificationCenter
{
    public const CATEGORY_LOAN_SUBMITTED = 'loan_application_submitted';

    public const CATEGORY_LOAN_APPROVED = 'loan_application_approved';

    public const CATEGORY_LOAN_REJECTED = 'loan_application_rejected';

    public const CATEGORY_VERIFICATION_REQUIRED = 'verification_required';

    public const CATEGORY_MISSING_DOCUMENTS = 'missing_documents';

    public const CATEGORY_PAYMENT_DUE = 'payment_due_reminder';

    public const CATEGORY_PAYMENT_RECEIVED = 'payment_received';

    /** Admin corrected final installment scheduled amount (discount/penalty/settlement). */
    public const CATEGORY_LOAN_PAYMENT_ADJUSTED = 'loan_payment_adjusted';

    public const CATEGORY_PAYMENT_OVERDUE = 'payment_overdue';

    public const CATEGORY_CRM_INQUIRY = 'crm_customer_inquiry';

    public const CATEGORY_ADMIN_INTERNAL = 'admin_internal';

    public const CATEGORY_FEEDBACK = 'feedback_submitted';

    public const CATEGORY_SUPPORT_TICKET = 'support_ticket_update';

    public const CATEGORY_ACCOUNT = 'account_verification';

    public const CATEGORY_SECURITY = 'security_alert';

    public const CATEGORY_DOCUMENT_REVIEW = 'document_verification';

    public const CATEGORY_PAYMENT_SUBMITTED = 'borrower_payment_submitted';

    public const CATEGORY_LOAN_OFFICER_ASSIGNED = 'loan_officer_assigned';

    public const MODULE_LOANS = 'loans';

    public const MODULE_PAYMENTS = 'payments';

    public const MODULE_CRM = 'crm';

    public const MODULE_FEEDBACK = 'feedback';

    public const MODULE_AUTH = 'auth';

    public const MODULE_SYSTEM = 'system';

    public function preferencesFor(User $user): NotificationPreference
    {
        return NotificationPreference::query()->firstOrCreate(
            ['user_id' => $user->id],
            ['in_app' => true, 'email' => true, 'sms' => false, 'muted_categories' => []],
        );
    }

    public function categoryIsMuted(User $user, string $category): bool
    {
        $muted = $this->preferencesFor($user)->muted_categories;

        return is_array($muted) && in_array($category, $muted, true);
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{dedupe_key?: string|null, priority?: int, module?: string|null, delivery_channels?: array<int, string>}  $options
     */
    public function notifyBorrower(
        User $borrower,
        string $category,
        string $type,
        string $title,
        ?string $body,
        array $data = [],
        array $options = [],
    ): ?BorrowerNotification {
        if (! $borrower->exists) {
            return null;
        }

        $prefs = $this->preferencesFor($borrower);
        if (! $prefs->in_app || $this->categoryIsMuted($borrower, $category)) {
            return null;
        }

        $dedupeKey = isset($options['dedupe_key']) ? trim((string) $options['dedupe_key']) : '';
        $priority = (int) ($options['priority'] ?? $this->defaultPriorityForCategory($category));
        $module = isset($options['module']) ? trim((string) $options['module']) : null;
        $channels = $options['delivery_channels'] ?? ['in_app'];
        if ($dedupeKey !== '') {
            $existing = BorrowerNotification::query()
                ->where('user_id', $borrower->id)
                ->where('dedupe_key', $dedupeKey)
                ->first();
            if ($existing) {
                $existing->fill([
                    'type' => $type,
                    'category' => $category,
                    'priority' => $priority,
                    'module' => $module,
                    'title' => $title,
                    'body' => $body,
                    'data' => $data,
                    'delivery_channels' => $channels,
                ]);
                $existing->save();
                $this->logBorrowerDelivery($existing->id, 'in_app', 'updated');

                return $existing;
            }
        }

        $row = BorrowerNotification::create([
            'user_id' => $borrower->id,
            'type' => $type,
            'category' => $category,
            'priority' => $priority,
            'module' => $module,
            'title' => $title,
            'body' => $body,
            'dedupe_key' => $dedupeKey !== '' ? $dedupeKey : null,
            'data' => $data,
            'delivery_channels' => $channels,
            'read_at' => null,
            'archived_at' => null,
        ]);

        $this->logBorrowerDelivery($row->id, 'in_app', 'sent');

        return $row;
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array{priority?: int, module?: string|null, delivery_channels?: array<int, string>, throttle_key?: string|null, throttle_max?: int, throttle_decay_seconds?: int, dedupe_key?: string|null}  $options
     */
    public function notifyStaff(
        string $category,
        string $type,
        string $title,
        ?string $body,
        array $data = [],
        ?int $actorUserId = null,
        array $options = [],
    ): ?AdminNotification {
        $throttleKey = isset($options['throttle_key']) ? trim((string) $options['throttle_key']) : '';
        if ($throttleKey !== '') {
            $max = (int) ($options['throttle_max'] ?? 8);
            $decay = (int) ($options['throttle_decay_seconds'] ?? 3600);
            if (! RateLimiter::attempt('staff-notif:'.$throttleKey, $max, fn () => true, $decay)) {
                return null;
            }
        }

        $priority = (int) ($options['priority'] ?? $this->defaultPriorityForCategory($category));
        $module = isset($options['module']) ? trim((string) $options['module']) : null;
        $channels = $options['delivery_channels'] ?? ['in_app'];
        $dedupeKey = isset($options['dedupe_key']) ? trim((string) $options['dedupe_key']) : '';

        if ($dedupeKey !== '') {
            $existing = AdminNotification::query()
                ->whereNull('dismissed_globally_at')
                ->where('type', $type)
                ->where('category', $category)
                ->where('data->dedupe_key', $dedupeKey)
                ->where('created_at', '>=', now()->subDays(2))
                ->latest('id')
                ->first();
            if ($existing) {
                $payload = is_array($existing->data) ? $existing->data : [];
                $existing->fill([
                    'priority' => $priority,
                    'module' => $module,
                    'title' => $title,
                    'body' => $body,
                    'data' => array_merge($payload, $data, ['dedupe_key' => $dedupeKey]),
                    'delivery_channels' => $channels,
                ]);
                $existing->save();
                $this->logAdminDelivery($existing->id, 'in_app', 'updated', 'dedupe_hit');

                return $existing;
            }
            $data = array_merge($data, ['dedupe_key' => $dedupeKey]);
        }

        $row = AdminNotification::create([
            'user_id' => $actorUserId,
            'type' => $type,
            'category' => $category,
            'priority' => $priority,
            'module' => $module,
            'title' => $title,
            'body' => $body,
            'data' => $data,
            'delivery_channels' => $channels,
            'read_at' => null,
            'dismissed_globally_at' => null,
        ]);

        $this->logAdminDelivery($row->id, 'in_app', 'sent');

        return $row;
    }

    public function logBorrowerDelivery(int $notificationId, string $channel, string $status, ?string $detail = null, ?array $meta = null): void
    {
        $this->writeLog(NotificationDeliveryLog::AUDIENCE_BORROWER, $notificationId, $channel, $status, $detail, $meta);
    }

    public function logAdminDelivery(int $notificationId, string $channel, string $status, ?string $detail = null, ?array $meta = null): void
    {
        $this->writeLog(NotificationDeliveryLog::AUDIENCE_ADMIN, $notificationId, $channel, $status, $detail, $meta);
    }

    public function recordFailure(string $audience, ?int $notificationId, string $channel, \Throwable $e, ?array $payload = null): void
    {
        FailedNotification::create([
            'audience' => $audience,
            'notification_id' => $notificationId,
            'channel' => $channel,
            'error_class' => $e::class,
            'error_message' => mb_substr($e->getMessage(), 0, 65000),
            'payload' => $payload,
            'attempts' => 1,
            'next_retry_at' => now()->addMinutes(5),
        ]);
    }

    /**
     * Staff notifications visible as unread for a given admin user.
     */
    public function adminNotificationsUnreadQuery(int $userId)
    {
        return AdminNotification::query()
            ->whereNull('dismissed_globally_at')
            ->whereDoesntHave('userReads', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            });
    }

    public function markAdminNotificationReadForUser(AdminNotification $notification, int $userId): void
    {
        AdminNotificationRead::query()->firstOrCreate(
            [
                'admin_notification_id' => $notification->id,
                'user_id' => $userId,
            ],
            ['read_at' => now()],
        );
    }

    public function markAllAdminNotificationsReadForUser(int $userId): int
    {
        $ids = $this->adminNotificationsUnreadQuery($userId)->pluck('id');
        if ($ids->isEmpty()) {
            return 0;
        }

        $now = now();
        $rows = $ids->map(fn (int $id) => [
            'admin_notification_id' => $id,
            'user_id' => $userId,
            'read_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        foreach (array_chunk($rows, 250) as $chunk) {
            DB::table('admin_notification_reads')->insertOrIgnore($chunk);
        }

        return count($rows);
    }

    private function writeLog(string $audience, int $notificationId, string $channel, string $status, ?string $detail, ?array $meta): void
    {
        try {
            NotificationDeliveryLog::create([
                'audience' => $audience,
                'notification_id' => $notificationId,
                'channel' => $channel,
                'status' => $status,
                'detail' => $detail,
                'meta' => $meta,
            ]);
        } catch (\Throwable) {
            // Never break primary flows on log insert failures.
        }
    }

    private function defaultPriorityForCategory(string $category): int
    {
        return match ($category) {
            self::CATEGORY_SECURITY => 5,
            self::CATEGORY_PAYMENT_OVERDUE, self::CATEGORY_CRM_INQUIRY => 4,
            self::CATEGORY_PAYMENT_DUE, self::CATEGORY_VERIFICATION_REQUIRED, self::CATEGORY_MISSING_DOCUMENTS => 3,
            default => 2,
        };
    }
}
