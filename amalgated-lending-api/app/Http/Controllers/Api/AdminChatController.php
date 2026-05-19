<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\SupportAssignment;
use App\Models\SupportChatFeedback;
use App\Models\SupportConversation;
use App\Services\ChatMessageReceiptService;
use App\Services\NodeChatBroadcastService;
use App\Support\SupportChatPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminChatController extends Controller
{
    public function conversations(Request $request): JsonResponse
    {
        $bucket = strtolower((string) $request->query('bucket', 'all'));

        $aggregateQuery = ChatMessage::query()
            ->from('chat_messages as cm')
            ->select('cm.session_id')
            ->selectRaw('MAX(cm.created_at) as last_message_at')
            ->selectRaw('SUM(CASE WHEN cm.is_from_visitor = 1 THEN 1 ELSE 0 END) as visitor_message_count')
            ->where('cm.is_feedback', false)
            ->groupBy('cm.session_id');

        $latestMessageSub = ChatMessage::query()
            ->from('chat_messages as lm')
            ->selectRaw('lm.session_id, MAX(lm.id) as latest_id')
            ->where('lm.is_feedback', false)
            ->groupBy('lm.session_id');

        $latestVisitorSub = ChatMessage::query()
            ->from('chat_messages as vm')
            ->selectRaw('vm.session_id, MAX(vm.id) as latest_visitor_id')
            ->whereNotNull('vm.visitor_id')
            ->where('vm.is_feedback', false)
            ->groupBy('vm.session_id');

        $query = DB::query()
            ->fromSub($aggregateQuery, 'agg')
            ->leftJoinSub($latestMessageSub, 'latest', function ($join) {
                $join->on('latest.session_id', '=', 'agg.session_id');
            })
            ->leftJoin('chat_messages as msg', 'msg.id', '=', 'latest.latest_id')
            ->leftJoinSub($latestVisitorSub, 'visitor_latest', function ($join) {
                $join->on('visitor_latest.session_id', '=', 'agg.session_id');
            })
            ->leftJoin('chat_messages as visitor_msg', 'visitor_msg.id', '=', 'visitor_latest.latest_visitor_id')
            ->leftJoin('support_conversations as sc', 'sc.session_id', '=', 'agg.session_id')
            ->leftJoin('users as admin_users', 'admin_users.id', '=', 'msg.admin_user_id');

        $statusOnly = strtolower((string) $request->query('status', ''));
        if ($bucket === 'all' && $statusOnly !== '' && $statusOnly !== 'all') {
            $mapped = SupportConversation::mapLifecycleToStatus($statusOnly);
            $query->whereRaw('LOWER(COALESCE(sc.status, ?)) = ?', ['open', strtolower($mapped)]);
        }

        switch ($bucket) {
            case 'feedback_only':
                $query->whereExists(function ($q) {
                    $q->select(DB::raw(1))
                        ->from('support_chat_feedback as f')
                        ->whereColumn('f.session_id', 'agg.session_id');
                });
                break;
            case 'escalated':
                $query->where(function ($q) {
                    $q->where('sc.needs_human', '=', 1)->orWhereNotNull('sc.escalated_at');
                });
                break;
            case 'ai_handled':
                $query->where('sc.mode', '=', 'ai')
                    ->where('sc.last_responder_type', '=', 'ai');
                break;
            case 'human_handled':
                $query->where(function ($q) {
                    $q->where('sc.mode', '=', 'human')
                        ->orWhere('sc.last_responder_type', '=', 'admin');
                });
                break;
            case 'pending_response':
                $query->where(function ($q) {
                    $q->where('sc.last_responder_type', '=', 'customer')
                        ->orWhere('msg.sender_type', '=', 'customer')
                        ->orWhere('msg.is_from_visitor', '=', 1);
                });
                break;
            case 'new':
                $query->where(function ($q) {
                    $q->where('sc.unread_admin', '>', 0)
                        ->orWhere(function ($qq) {
                            $qq->whereNull('sc.session_id')->where('msg.is_from_visitor', '=', 1);
                        });
                });
                break;
        }

        $convLastActivitySql = 'GREATEST('
            .'COALESCE(sc.last_visitor_message_at, sc.last_staff_message_at), '
            .'COALESCE(sc.last_staff_message_at, sc.last_visitor_message_at)'
            .')';

        $rows = $query
            ->orderByRaw("COALESCE({$convLastActivitySql}, agg.last_message_at) DESC")
            ->limit(min(max((int) $request->query('limit', 200), 1), 500))
            ->get([
                'agg.session_id',
                'agg.last_message_at',
                'agg.visitor_message_count',
                'msg.id as message_id',
                'msg.message as message_content',
                'msg.is_from_visitor as message_is_from_visitor',
                'msg.is_from_admin as message_is_from_admin',
                'msg.sender_type as message_sender_type',
                'msg.sender_name as message_sender_name',
                'msg.created_at as message_created_at',
                'admin_users.name as admin_name',
                'visitor_msg.visitor_id as visitor_id',
                'sc.mode as conv_mode',
                'sc.status as conv_status',
                'sc.needs_human as conv_needs_human',
                'sc.guest_name',
                'sc.guest_email',
                'sc.unread_admin',
                'sc.last_responder_type',
                'sc.assigned_to',
                DB::raw("{$convLastActivitySql} as conv_last_message_at"),
                'sc.updated_at as conv_updated_at',
            ]);

        $data = $rows->map(function ($row) {
            $latestChat = ChatMessage::make([
                'id' => $row->message_id,
                'session_id' => $row->session_id,
                'visitor_id' => $row->visitor_id,
                'message' => $row->message_content,
                'is_from_visitor' => (bool) $row->message_is_from_visitor,
                'is_from_admin' => (bool) $row->message_is_from_admin,
                'sender_type' => $row->message_sender_type,
                'sender_name' => $row->message_sender_name,
                'rating' => null,
                'routing_status' => null,
                'is_feedback' => false,
                'admin_user_id' => null,
                'created_at' => $row->message_created_at,
            ]);
            // Attach admin relation for presenter if synthetic admin-only row
            if ($row->message_is_from_admin && $row->admin_name && ! $latestChat->sender_name) {
                $latestChat->sender_name = $row->admin_name;
            }

            $uc = (int) ($row->unread_admin ?? 0);
            $warehouseStatus = $row->conv_status ?: 'open';
            $lastActivity = $row->conv_last_message_at ?: $row->last_message_at;
            $visitorType = ($row->conv_mode ?? 'ai') === 'human' ? 'human' : 'ai';

            return [
                'id' => $row->session_id,
                'session_id' => $row->session_id,
                'visitor_id' => $row->visitor_id,
                'visitor_name' => $row->guest_name ?: 'Website Visitor',
                'visitor_email' => $row->guest_email,
                'status' => $warehouseStatus,
                'lifecycle_status' => SupportConversation::mapStatusToLifecycle($warehouseStatus),
                'visitor_type' => $visitorType,
                'mode' => $row->conv_mode ?: 'ai',
                'needs_human' => (bool) $row->conv_needs_human,
                'assigned_to' => $row->assigned_to,
                'last_handling' => $row->last_responder_type,
                'last_message_at' => $lastActivity,
                'updated_at' => $lastActivity,
                'conversation_updated_at' => $row->conv_updated_at,
                'unread_count' => $uc,
                /** CRM UI historically used admin_unread_count */
                'admin_unread_count' => $uc,
                'visitor_message_count' => (int) $row->visitor_message_count,
                'last_message' => $row->message_id ? SupportChatPresenter::message($latestChat) : null,
            ];
        });

        return response()->json($data->values());
    }

    public function analytics(Request $request): JsonResponse
    {
        $sinceDays = max(1, min((int) $request->query('days', 30), 366));
        $since = now()->subDays($sinceDays);

        /** One aggregate scan over `chat_messages` instead of four separate COUNT queries. */
        $msgAgg = DB::selectOne(
            'SELECT '
            .'SUM(CASE WHEN is_feedback = 0 THEN 1 ELSE 0 END) AS total_messages, '
            .'SUM(CASE WHEN is_feedback = 0 AND (sender_type = ? OR (sender_type IS NULL AND is_from_visitor = 1)) THEN 1 ELSE 0 END) AS visitor_messages, '
            .'SUM(CASE WHEN sender_type = ? THEN 1 ELSE 0 END) AS ai_messages, '
            .'SUM(CASE WHEN is_feedback = 0 AND (sender_type = ? OR is_from_admin = 1) THEN 1 ELSE 0 END) AS admin_messages '
            .'FROM chat_messages WHERE created_at >= ?',
            ['customer', 'ai', 'admin', $since],
        );

        $totalMessages = (int) ($msgAgg->total_messages ?? 0);
        $visitorMessages = (int) ($msgAgg->visitor_messages ?? 0);
        $aiMessages = (int) ($msgAgg->ai_messages ?? 0);
        $adminMessages = (int) ($msgAgg->admin_messages ?? 0);

        $fb = DB::selectOne(
            'SELECT COUNT(*) AS c, AVG(rating) AS avg_rating FROM support_chat_feedback WHERE created_at >= ?',
            [$since],
        );
        $feedbackCount = (int) ($fb->c ?? 0);
        $ratingAvg = $fb->avg_rating ?? null;

        $convAgg = DB::selectOne(
            'SELECT '
            .'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS resolved, '
            .'SUM(CASE WHEN needs_human = 1 OR escalated_at IS NOT NULL THEN 1 ELSE 0 END) AS escalations '
            .'FROM support_conversations WHERE created_at >= ?',
            ['resolved', $since],
        );
        $resolvedConversations = (int) ($convAgg->resolved ?? 0);
        $escalations = (int) ($convAgg->escalations ?? 0);

        return response()->json([
            'ok' => true,
            'period_days' => $sinceDays,
            'totals' => [
                'messages' => $totalMessages,
                'visitor_messages' => $visitorMessages,
                'ai_messages' => $aiMessages,
                'admin_messages' => $adminMessages,
                'feedback' => $feedbackCount,
                'resolved_conversations' => $resolvedConversations,
                'escalations' => $escalations,
                'average_rating' => $ratingAvg !== null ? round((float) $ratingAvg, 2) : null,
            ],
            'rates' => [
                'ai_reply_share' => $totalMessages > 0 ? round(100 * $aiMessages / $totalMessages, 1) : 0,
                'human_reply_share' => $totalMessages > 0 ? round(100 * $adminMessages / $totalMessages, 1) : 0,
                'resolution_share' => $resolvedConversations + $escalations > 0
                    ? round(100 * $resolvedConversations / max($resolvedConversations + $escalations, 1), 1)
                    : null,
            ],
        ]);
    }

    /**
     * Same response shape as chat-server `emptyAnalytics()` / successful `GET /api/admin/analytics`.
     * Visitor page-hit data lives in Node; Laravel returns zeros so admin SPA charts load without error.
     */
    public function visitorAnalytics(): JsonResponse
    {
        $empty = [
            'visits' => 0,
            'totalVisits' => 0,
            'totalMessages' => 0,
            'viewersCount' => 0,
            'messagedCount' => 0,
            'avgDurationSeconds' => 0,
            'byDevice' => (object) [],
            'byBrowser' => (object) [],
            'byLocation' => (object) [],
            'byDeviceMessaged' => (object) [],
            'byBrowserMessaged' => (object) [],
            'byLocationMessaged' => (object) [],
            'recentVisits' => [],
            'recentViewers' => [],
            'recentMessaged' => [],
        ];

        return response()->json($empty);
    }

    public function messages(Request $request, string $sessionId): JsonResponse
    {
        $afterId = max((int) $request->query('after_id', 0), 0);
        $limit = min(max((int) $request->query('limit', 150), 1), 500);
        $sid = trim($sessionId);

        $receipts = app(ChatMessageReceiptService::class);
        $readThrough = $receipts->parseThroughId($request->query('receipt_read_through_id'));
        $deliveryThrough = $receipts->parseThroughId($request->query('receipt_delivery_through_id'));
        if ($readThrough > 0) {
            $receipts->applyReadThrough($sid, $readThrough, false);
        }
        if ($deliveryThrough > 0) {
            $receipts->applyDeliveryThrough($sid, $deliveryThrough, false);
        }

        $baseQuery = fn () => ChatMessage::query()
            ->select([
                'id',
                'session_id',
                'visitor_id',
                'sender_type',
                'sender_name',
                'rating',
                'routing_status',
                'is_feedback',
                'message',
                'is_from_visitor',
                'is_from_admin',
                'admin_user_id',
                'sent_at',
                'delivered_at',
                'read_at',
                'created_at',
                'updated_at',
            ])
            ->where('session_id', $sid)
            ->where('is_feedback', false)
            ->when($afterId > 0, fn ($query) => $query->where('id', '>', $afterId))
            ->orderByRaw('COALESCE(sent_at, created_at) asc')
            ->orderBy('id')
            ->with('adminUser:id,name')
            ->limit($limit);

        $rows = $baseQuery()->get();

        if ($request->user() && $request->boolean('auto_mark_visitor_receipts', true)) {
            $maxVisitorId = (int) $rows->where('is_from_visitor', true)->max('id');
            if ($maxVisitorId > 0) {
                $n = $receipts->applyReadThrough($sid, $maxVisitorId, false);
                $n += $receipts->applyDeliveryThrough($sid, $maxVisitorId, false);
                if ($n > 0) {
                    $rows = $baseQuery()->get();
                }
            }
        }

        return response()->json($rows->map(fn (ChatMessage $row) => SupportChatPresenter::message($row))->values());
    }

    public function sendMessage(Request $request, string $sessionId): JsonResponse
    {
        $data = $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $clean = SupportChatPresenter::sanitizeBody($data['message']);
        if ($clean === '') {
            return response()->json(['message' => 'Invalid message.'], 422);
        }

        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => trim($sessionId)],
            ['mode' => 'human', 'status' => 'in_progress']
        );

        $message = ChatMessage::create([
            'support_conversation_id' => $conv->id,
            'session_id' => $conv->session_id,
            'message' => $clean,
            'sender_type' => 'admin',
            'sender_name' => $request->user()?->name,
            'is_from_visitor' => false,
            'is_from_admin' => true,
            'admin_user_id' => $request->user()?->id,
        ]);

        $conv->mode = 'human';
        $conv->status = 'in_progress';
        $conv->last_responder_type = 'admin';
        $conv->unread_admin = 0;
        $conv->save();

        $message->loadMissing('adminUser:id,name');

        NodeChatBroadcastService::relayAdminReply($message);

        return response()->json([
            'ok' => true,
            'message' => SupportChatPresenter::message($message),
        ], 201);
    }

    public function patchStatus(Request $request, string $sessionId): JsonResponse
    {
        $data = $request->validate([
            'status' => 'sometimes|string|max:48',
            'needs_human' => 'sometimes|boolean',
            'mode' => 'sometimes|string|max:24',
            'unread_admin' => 'sometimes|integer|min:0|max:999',
        ]);

        $hasUnread = array_key_exists('unread_admin', $data);

        if (! isset($data['status']) && ! isset($data['mode']) && ! $request->has('needs_human') && ! $hasUnread) {
            return response()->json([
                'message' => 'Provide at least one of: status, mode, needs_human, unread_admin.',
            ], 422);
        }

        $sid = trim($sessionId);
        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => $sid],
            ['mode' => 'ai', 'status' => 'open']
        );

        if (isset($data['status']) && $data['status'] !== '') {
            $normalized = SupportConversation::mapLifecycleToStatus(strtolower(trim((string) $data['status'])));
            $allowed = ['open', 'in_progress', 'resolved', 'archived'];
            if (! in_array($normalized, $allowed, true)) {
                return response()->json([
                    'message' => 'Invalid status.',
                    'errors' => ['status' => ['Must be one of: '.implode(', ', $allowed).', active, pending, closed.']],
                ], 422);
            }
            $conv->status = $normalized;
            if ($conv->status === 'resolved') {
                $conv->resolved_at = now();
            }
        }
        if ($request->has('needs_human')) {
            $conv->needs_human = (bool) $data['needs_human'];
        }
        if (isset($data['mode']) && $data['mode'] !== '') {
            $conv->mode = strtolower((string) $data['mode']);
        }
        if ($hasUnread) {
            $conv->unread_admin = (int) $data['unread_admin'];
        }
        $conv->save();

        return response()->json(['ok' => true, 'data' => $conv->only([
            'session_id', 'mode', 'status', 'needs_human', 'assigned_to', 'unread_admin',
        ])]);
    }

    public function assignConversation(Request $request, string $sessionId): JsonResponse
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => trim($sessionId)],
            []
        );

        $uid = (int) $data['user_id'];
        $conv->assigned_to = $uid;
        $conv->status = $conv->status === 'resolved' ? 'in_progress' : $conv->status;
        $conv->save();

        SupportAssignment::query()->create([
            'support_conversation_id' => $conv->id,
            'user_id' => $uid,
            'assigned_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function destroyConversation(string $sessionId): JsonResponse
    {
        $conv = SupportConversation::query()->where('session_id', trim($sessionId))->first();

        ChatMessage::query()->where('session_id', trim($sessionId))->delete();

        SupportChatFeedback::query()->where('session_id', trim($sessionId))->delete();

        if ($conv) {
            $conv->delete();
        }

        return response()->json(['ok' => true]);
    }
}
