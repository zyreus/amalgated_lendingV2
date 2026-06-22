<?php

namespace App\Services;

use App\Events\WebsiteChatMessageReceived;
use App\Models\AdminNotification;
use App\Models\AdminNotificationRead;
use App\Models\BorrowerNotification;
use App\Models\ChatMessage;
use App\Models\FailedNotification;
use App\Models\SupportConversation;
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

    public const CATEGORY_LOAN_PRE_APPROVED = 'loan_application_pre_approved';

    public const CATEGORY_LOAN_REJECTED = 'loan_application_rejected';

    public const CATEGORY_VERIFICATION_REQUIRED = 'verification_required';

    public const CATEGORY_MISSING_DOCUMENTS = 'missing_documents';

    public const CATEGORY_PAYMENT_DUE = 'payment_due_reminder';

    public const CATEGORY_PAYMENT_RECEIVED = 'payment_received';

    /** Admin corrected final installment scheduled amount (discount/penalty/settlement). */
    public const CATEGORY_LOAN_PAYMENT_ADJUSTED = 'loan_payment_adjusted';

    public const CATEGORY_PAYMENT_OVERDUE = 'payment_overdue';

    public const CATEGORY_CREDIT_WELLNESS = 'credit_wellness';

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

    public const MODULE_CREDIT_WELLNESS = 'credit_wellness';

    /**
     * @return array<string, bool|float>
     */
    public static function defaultWebsiteChatSettings(): array
    {
        return [
            'enabled' => true,
            'sound' => true,
            'browser' => true,
            'badge_updates' => true,
            'crm_inbox_updates' => true,
            'auto_open_crm' => false,
            'sound_volume' => 0.7,
        ];
    }

    /**
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $patch
     * @return array<string, bool|float>
     */
    public static function mergeWebsiteChatSettings(array $current, array $patch): array
    {
        $defaults = self::defaultWebsiteChatSettings();
        $merged = array_merge($defaults, $current, $patch);

        return [
            'enabled' => (bool) ($merged['enabled'] ?? true),
            'sound' => (bool) ($merged['sound'] ?? true),
            'browser' => (bool) ($merged['browser'] ?? true),
            'badge_updates' => (bool) ($merged['badge_updates'] ?? true),
            'crm_inbox_updates' => (bool) ($merged['crm_inbox_updates'] ?? true),
            'auto_open_crm' => (bool) ($merged['auto_open_crm'] ?? false),
            'sound_volume' => max(0, min(1, (float) ($merged['sound_volume'] ?? 0.7))),
        ];
    }

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
        $redirect = $this->redirectMetadata('borrower', $type, $category, $data, $options);
        if ($dedupeKey !== '') {
            $existing = BorrowerNotification::query()
                ->where('user_id', $borrower->id)
                ->where('dedupe_key', $dedupeKey)
                ->first();
            if ($existing) {
                $existing->fill([
                    'type' => $type,
                    'notification_type' => $redirect['notification_type'],
                    'category' => $category,
                    'priority' => $priority,
                    'module' => $module,
                    'title' => $title,
                    'body' => $body,
                    'resource_type' => $redirect['resource_type'],
                    'resource_id' => $redirect['resource_id'],
                    'route_name' => $redirect['route_name'],
                    'route_params' => $redirect['route_params'],
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
            'notification_type' => $redirect['notification_type'],
            'category' => $category,
            'priority' => $priority,
            'module' => $module,
            'title' => $title,
            'body' => $body,
            'resource_type' => $redirect['resource_type'],
            'resource_id' => $redirect['resource_id'],
            'route_name' => $redirect['route_name'],
            'route_params' => $redirect['route_params'],
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
        $redirect = $this->redirectMetadata('admin', $type, $category, $data, $options);

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
                    'notification_type' => $redirect['notification_type'],
                    'priority' => $priority,
                    'module' => $module,
                    'title' => $title,
                    'body' => $body,
                    'resource_type' => $redirect['resource_type'],
                    'resource_id' => $redirect['resource_id'],
                    'route_name' => $redirect['route_name'],
                    'route_params' => $redirect['route_params'],
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
            'notification_type' => $redirect['notification_type'],
            'category' => $category,
            'priority' => $priority,
            'module' => $module,
            'title' => $title,
            'body' => $body,
            'resource_type' => $redirect['resource_type'],
            'resource_id' => $redirect['resource_id'],
            'route_name' => $redirect['route_name'],
            'route_params' => $redirect['route_params'],
            'data' => $data,
            'delivery_channels' => $channels,
            'read_at' => null,
            'dismissed_globally_at' => null,
        ]);

        $this->logAdminDelivery($row->id, 'in_app', 'sent');

        try {
            app(StaffEmailNotifier::class)->dispatchForAdminNotification($row);
        } catch (\Throwable) {
            // Never break primary flows on staff email failures.
        }

        return $row;
    }

    /**
     * Staff notification for website chat visitor messages with grouping and realtime broadcast.
     */
    public function notifyStaffWebsiteChatMessage(
        SupportConversation $conv,
        ChatMessage $message,
        string $messagePreview,
    ): ?AdminNotification {
        $sessionId = trim((string) $conv->session_id);
        if ($sessionId === '') {
            return null;
        }

        $visitorName = trim((string) ($conv->guest_name ?? ''));
        if ($visitorName === '') {
            $visitorName = 'Website Visitor';
        }

        $visitorId = trim((string) ($message->visitor_id ?? $conv->visitor_id ?? $sessionId));
        $preview = mb_substr(trim($messagePreview), 0, 240);
        $timestamp = optional($message->created_at ?? now())?->toIso8601String();

        $existingByMessage = AdminNotification::query()
            ->where('type', 'website_chat_message')
            ->where('message_id', $message->id)
            ->first();
        if ($existingByMessage) {
            return $existingByMessage;
        }

        $existing = AdminNotification::query()
            ->whereNull('dismissed_globally_at')
            ->where('type', 'website_chat_message')
            ->where('conversation_id', $sessionId)
            ->where('created_at', '>=', now()->subMinutes(30))
            ->latest('id')
            ->first();

        $messageCount = 1;
        if ($existing) {
            $payload = is_array($existing->data) ? $existing->data : [];
            $messageCount = max(1, (int) ($payload['message_count'] ?? 1)) + 1;
        }

        $title = $messageCount > 1
            ? "{$visitorName} sent {$messageCount} messages"
            : 'New Website Chat Message';

        $body = $messageCount > 1
            ? "{$messageCount} new website messages"
            : "{$visitorName} sent a new message";

        $data = [
            'conversation_id' => $sessionId,
            'session_id' => $sessionId,
            'message_id' => $message->id,
            'chat_message_id' => $message->id,
            'visitor_id' => $visitorId,
            'visitor_name' => $visitorName,
            'notification_type' => 'website_chat_message',
            'message_preview' => $preview,
            'message_count' => $messageCount,
            'timestamp' => $timestamp,
            'support_conversation_id' => $conv->id,
        ];

        if ($existing) {
            AdminNotificationRead::query()
                ->where('admin_notification_id', $existing->id)
                ->delete();

            $existing->fill([
                'title' => $title,
                'body' => $body,
                'message_id' => $message->id,
                'visitor_id' => $visitorId,
                'data' => array_merge(is_array($existing->data) ? $existing->data : [], $data),
            ]);
            $existing->touch();
            $existing->save();
            $row = $existing;
            $this->logAdminDelivery($row->id, 'in_app', 'updated', 'grouped');
        } else {
            $redirect = $this->redirectMetadata('admin', 'website_chat_message', self::CATEGORY_CRM_INQUIRY, $data, [
                'module' => self::MODULE_CRM,
            ]);

            $row = AdminNotification::create([
                'user_id' => null,
                'type' => 'website_chat_message',
                'notification_type' => 'website_chat_message',
                'category' => self::CATEGORY_CRM_INQUIRY,
                'priority' => $this->defaultPriorityForCategory(self::CATEGORY_CRM_INQUIRY),
                'module' => self::MODULE_CRM,
                'title' => $title,
                'body' => $body,
                'resource_type' => $redirect['resource_type'],
                'resource_id' => $redirect['resource_id'],
                'route_name' => $redirect['route_name'],
                'route_params' => $redirect['route_params'],
                'conversation_id' => $sessionId,
                'message_id' => $message->id,
                'visitor_id' => $visitorId,
                'data' => $data,
                'delivery_channels' => ['in_app'],
                'read_at' => null,
                'dismissed_globally_at' => null,
            ]);

            $this->logAdminDelivery($row->id, 'in_app', 'sent');
        }

        $broadcastPayload = [
            'conversation_id' => $sessionId,
            'message_id' => $message->id,
            'visitor_id' => $visitorId,
            'visitor_name' => $visitorName,
            'message_preview' => $preview,
            'timestamp' => $timestamp,
            'notification_id' => $row->id,
            'message_count' => $messageCount,
            'title' => $title,
            'body' => $body,
        ];

        try {
            event(new WebsiteChatMessageReceived($broadcastPayload));
        } catch (\Throwable) {
            // Never break chat flows on broadcast failures.
        }

        try {
            NodeChatBroadcastService::relayWebsiteChatNotification($broadcastPayload);
        } catch (\Throwable) {
            // Socket relay is best-effort when Node chat-server is available.
        }

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

    /**
     * @return array<string, mixed>
     */
    public function adminNotificationPayload(AdminNotification $notification, int $userId): array
    {
        $readAt = $notification->relationLoaded('userReads')
            ? optional($notification->userReads->firstWhere('user_id', $userId)?->read_at)?->toIso8601String()
            : null;
        $isRead = (bool) ($notification->is_read ?? $readAt);

        $row = $notification->toArray();
        $row['notification_type'] = $notification->notification_type ?: $notification->type;
        $row['is_read'] = $isRead;
        $row['read_at'] = $readAt;

        return array_merge($row, $this->decoratedRedirect($notification, 'admin'));
    }

    /**
     * @return array<string, mixed>
     */
    public function borrowerNotificationPayload(BorrowerNotification $notification): array
    {
        $row = $notification->toArray();
        $row['notification_type'] = $notification->notification_type ?: $notification->type;
        $row['is_read'] = $notification->read_at !== null;
        $row['read_at'] = optional($notification->read_at)?->toIso8601String();

        return array_merge($row, $this->decoratedRedirect($notification, 'borrower'));
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
            self::CATEGORY_PAYMENT_OVERDUE, self::CATEGORY_CRM_INQUIRY, self::CATEGORY_CREDIT_WELLNESS => 4,
            self::CATEGORY_PAYMENT_DUE, self::CATEGORY_VERIFICATION_REQUIRED, self::CATEGORY_MISSING_DOCUMENTS => 3,
            default => 2,
        };
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $options
     * @return array{notification_type: string, resource_type: ?string, resource_id: ?string, route_name: string, route_params: array<string, mixed>}
     */
    private function redirectMetadata(string $audience, string $type, string $category, array $data, array $options = []): array
    {
        $notificationType = $this->stringOrNull($options['notification_type'] ?? $data['notification_type'] ?? null) ?: $type;
        $resourceType = $this->stringOrNull($options['resource_type'] ?? $data['resource_type'] ?? null);
        $resourceId = $this->stringOrNull($options['resource_id'] ?? $data['resource_id'] ?? null);
        $routeName = $this->stringOrNull($options['route_name'] ?? $data['route_name'] ?? null);
        $routeParams = $this->arrayOrEmpty($options['route_params'] ?? $data['route_params'] ?? null);

        if ($routeName) {
            return [
                'notification_type' => $notificationType,
                'resource_type' => $resourceType,
                'resource_id' => $resourceId,
                'route_name' => $routeName,
                'route_params' => $routeParams,
            ];
        }

        $loanId = $this->firstDataValue($data, ['loan_id', 'loanId']);
        $applicationId = $this->firstDataValue($data, ['loan_application_id', 'application_id', 'loanApplicationId']);
        $borrowerId = $this->firstDataValue($data, ['borrower_id', 'borrowerId', 'user_id', 'userId']);
        $paymentId = $this->firstDataValue($data, ['payment_id', 'paymentId']);
        $leadId = $this->firstDataValue($data, ['lead_id', 'leadId']);
        $ticketId = $this->firstDataValue($data, ['ticket_id', 'ticketId']);
        $conversationId = $this->firstDataValue($data, ['conversation_id', 'conversationId', 'session_id', 'sessionId']);
        $portalConversationId = $this->firstDataValue($data, ['portal_conversation_id', 'portalConversationId']);
        $documentId = $this->firstDataValue($data, ['document_id', 'uploaded_document_id', 'document_upload_id', 'documentId']);

        if (! $resourceType || ! $resourceId) {
            [$resourceType, $resourceId] = $this->inferResource($type, $category, [
                'loan' => $loanId,
                'loan_application' => $applicationId,
                'borrower' => $borrowerId,
                'payment' => $paymentId,
                'lead' => $leadId,
                'support_ticket' => $ticketId ?: $leadId,
                'crm_conversation' => $conversationId,
                'portal_conversation' => $portalConversationId,
                'document_upload' => $documentId,
            ]);
        }

        if (! $routeName) {
            $routeName = $this->inferRouteName($audience, $type, $category, (string) ($resourceType ?? ''));
        }

        $routeParams = array_filter(array_merge([
            'id' => $resourceId,
            'loan_id' => $loanId,
            'loan_application_id' => $applicationId,
            'borrower_id' => $borrowerId,
            'payment_id' => $paymentId,
            'lead_id' => $leadId,
            'ticket_id' => $ticketId ?: $leadId,
            'conversation_id' => $conversationId,
            'portal_conversation_id' => $portalConversationId,
            'document_id' => $documentId,
        ], $routeParams), fn ($value) => $value !== null && $value !== '');

        return [
            'notification_type' => $notificationType,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'route_name' => $routeName,
            'route_params' => $routeParams,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decoratedRedirect(AdminNotification|BorrowerNotification $notification, string $audience): array
    {
        $data = is_array($notification->data) ? $notification->data : [];
        $meta = $this->redirectMetadata($audience, (string) $notification->type, (string) $notification->category, $data, [
            'notification_type' => $notification->notification_type,
            'resource_type' => $notification->resource_type,
            'resource_id' => $notification->resource_id,
            'route_name' => $notification->route_name,
            'route_params' => $notification->route_params,
        ]);

        return [
            'notification_type' => $meta['notification_type'],
            'resource_type' => $meta['resource_type'],
            'resource_id' => $meta['resource_id'],
            'route_name' => $meta['route_name'],
            'route_params' => $meta['route_params'],
        ];
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array{?string, ?string}
     */
    private function inferResource(string $type, string $category, array $values): array
    {
        $haystack = strtolower($type.' '.$category);
        $ordered = str_contains($haystack, 'ticket')
            ? ['support_ticket', 'portal_conversation', 'crm_conversation', 'borrower', 'loan_application', 'loan', 'payment', 'document_upload', 'lead']
            : ['crm_conversation', 'portal_conversation', 'support_ticket', 'loan_application', 'loan', 'borrower', 'document_upload', 'payment', 'lead'];

        foreach ($ordered as $resourceType) {
            if (($values[$resourceType] ?? null) !== null && $values[$resourceType] !== '') {
                return [$resourceType, (string) $values[$resourceType]];
            }
        }

        return [null, null];
    }

    private function inferRouteName(string $audience, string $type, string $category, string $resourceType): string
    {
        $haystack = strtolower($type.' '.$category.' '.$resourceType);

        if ($audience === 'borrower') {
            if (str_contains($haystack, 'ticket')) {
                return 'borrower.support.ticket';
            }
            if (str_contains($haystack, 'portal') || str_contains($haystack, 'chat') || str_contains($haystack, 'message')) {
                return 'borrower.portal.conversation';
            }
            if (str_contains($haystack, 'document')) {
                return 'borrower.document.viewer';
            }
            if (str_contains($haystack, 'payment') || str_contains($haystack, 'receipt') || str_contains($haystack, 'installment')) {
                return 'borrower.payments';
            }
            if (str_contains($haystack, 'application') || str_contains($haystack, 'loan')) {
                return 'borrower.loan_application.details';
            }
            if (str_contains($haystack, 'verification') || str_contains($haystack, 'account')) {
                return 'borrower.profile.activity';
            }

            return 'borrower.notification.details';
        }

        if (str_contains($haystack, 'ticket')) {
            return 'admin.support.ticket';
        }
        if (str_contains($haystack, 'portal')) {
            return 'admin.portal.conversation';
        }
        if (str_contains($haystack, 'crm') || str_contains($haystack, 'chat') || str_contains($haystack, 'lead') || str_contains($haystack, 'inquiry')) {
            return 'admin.crm.thread';
        }
        if (str_contains($haystack, 'document')) {
            return 'admin.document.viewer';
        }
        if (str_contains($haystack, 'borrower') || str_contains($haystack, 'verification') || str_contains($haystack, 'account')) {
            return 'admin.borrower.profile';
        }
        if (str_contains($haystack, 'application') || str_contains($haystack, 'loan')) {
            return 'admin.loan_application.details';
        }
        if (str_contains($haystack, 'payment') || str_contains($haystack, 'receipt') || str_contains($haystack, 'installment')) {
            return 'admin.payments';
        }

        return 'admin.notification.details';
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<int, string>  $keys
     */
    private function firstDataValue(array $data, array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $data[$key] ?? null;
            if ($value !== null && $value !== '') {
                return (string) $value;
            }
        }

        return null;
    }

    private function stringOrNull(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value !== '' ? $value : null;
    }

    /**
     * @return array<string, mixed>
     */
    private function arrayOrEmpty(mixed $value): array
    {
        return is_array($value) ? $value : [];
    }
}
