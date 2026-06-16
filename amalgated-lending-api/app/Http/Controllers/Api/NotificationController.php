<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use App\Models\AdminNotificationRead;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function __construct(
        private NotificationCenter $notifications,
    ) {}

    public function poll(Request $request): JsonResponse
    {
        $user = $request->user();
        $sinceRaw = $request->query('since');
        $changed = true;
        if (is_string($sinceRaw) && $sinceRaw !== '') {
            try {
                $since = Carbon::parse($sinceRaw);
                $changed = AdminNotification::query()
                    ->where(function ($w) use ($since) {
                        $w->where('created_at', '>', $since)
                            ->orWhere('updated_at', '>', $since);
                    })
                    ->whereNull('dismissed_globally_at')
                    ->exists()
                    || AdminNotificationRead::query()
                        ->where('user_id', (int) $user->id)
                        ->where('updated_at', '>', $since)
                        ->exists();
            } catch (\Throwable) {
                $changed = true;
            }
        }

        $unread = $this->notifications->adminNotificationsUnreadQuery((int) $user->id)->count();
        $latest = AdminNotification::query()->orderByDesc('id')->value('created_at');

        return response()->json([
            'ok' => true,
            'changed' => $changed,
            'unread_count' => $unread,
            'latest_created_at' => optional($latest)?->toIso8601String(),
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $n = $this->notifications->adminNotificationsUnreadQuery((int) $request->user()->id)->count();

        return response()->json(['ok' => true, 'count' => $n]);
    }

    public function index(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $perPage = max(5, min(50, (int) $request->query('per_page', 20)));

        $q = AdminNotification::query()
            ->whereNull('dismissed_globally_at')
            ->with(['userReads' => fn ($w) => $w->where('user_id', $userId)])
            ->withExists(['userReads as is_read' => fn ($w) => $w->where('user_id', $userId)])
            ->orderByDesc('priority')
            ->orderByDesc('created_at');

        $category = trim((string) $request->query('category', ''));
        if ($category !== '') {
            $q->where('category', $category);
        }
        $module = trim((string) $request->query('module', ''));
        if ($module !== '') {
            $q->where('module', $module);
        }

        if ($request->boolean('unread_only')) {
            $q->whereDoesntHave('userReads', fn ($w) => $w->where('user_id', $userId));
        }

        $items = $q->paginate($perPage);
        $items->setCollection(
            $items->getCollection()
                ->map(fn (AdminNotification $notification) => $this->notifications->adminNotificationPayload($notification, $userId))
        );

        return response()->json(['ok' => true, 'data' => $items]);
    }

    public function markRead(Request $request, AdminNotification $notification): JsonResponse
    {
        if ($notification->dismissed_globally_at) {
            return response()->json(['ok' => true, 'note' => 'dismissed_broadcast']);
        }

        $this->notifications->markAdminNotificationReadForUser($notification, (int) $request->user()->id);

        return response()->json(['ok' => true]);
    }

    public function markUnread(Request $request, AdminNotification $notification): JsonResponse
    {
        AdminNotificationRead::query()
            ->where('admin_notification_id', $notification->id)
            ->where('user_id', (int) $request->user()->id)
            ->delete();

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $n = $this->notifications->markAllAdminNotificationsReadForUser((int) $request->user()->id);

        return response()->json(['ok' => true, 'marked' => $n]);
    }

    public function destroy(Request $request, AdminNotification $notification): JsonResponse
    {
        $notification->delete();

        return response()->json(['ok' => true]);
    }

    public function bulkDestroy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1'],
            'ids.*' => ['integer', Rule::exists('admin_notifications', 'id')],
        ]);

        $ids = collect($data['ids'])->map(fn ($id) => (int) $id)->unique()->values();
        $deleted = AdminNotification::query()->whereIn('id', $ids)->delete();

        return response()->json([
            'ok' => true,
            'deleted' => $deleted,
        ]);
    }

    public function clearAll(Request $request): JsonResponse
    {
        $userId = (int) $request->user()->id;
        $q = AdminNotification::query()->whereNull('dismissed_globally_at');

        $category = trim((string) $request->query('category', ''));
        if ($category !== '') {
            $q->where('category', $category);
        }
        $module = trim((string) $request->query('module', ''));
        if ($module !== '') {
            $q->where('module', $module);
        }
        if ($request->boolean('unread_only')) {
            $q->whereDoesntHave('userReads', fn ($w) => $w->where('user_id', $userId));
        }

        $deleted = $q->delete();

        return response()->json(['ok' => true, 'deleted' => $deleted]);
    }
}
