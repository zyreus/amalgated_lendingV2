<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class NotificationController extends Controller
{
    public function unreadCount(Request $request): JsonResponse
    {
        $n = AdminNotification::query()->whereNull('read_at')->count();

        return response()->json(['ok' => true, 'count' => $n]);
    }

    public function index(Request $request): JsonResponse
    {
        $q = AdminNotification::query()->orderByDesc('created_at');

        if ($request->boolean('unread_only')) {
            $q->whereNull('read_at');
        }

        $items = $q->paginate((int) $request->query('per_page', 20));

        return response()->json(['ok' => true, 'data' => $items]);
    }

    public function markRead(Request $request, AdminNotification $notification): JsonResponse
    {
        $notification->read_at = now();
        $notification->save();

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        AdminNotification::whereNull('read_at')->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
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
}
