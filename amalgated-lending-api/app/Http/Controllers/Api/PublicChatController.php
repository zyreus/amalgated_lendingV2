<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\FeedbackTicket;
use App\Models\SupportChatFeedback;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\ChatMessageReceiptService;
use App\Services\NotificationCenter;
use App\Services\SupportConversationHandoffService;
use App\Services\VisitorMessageLimitService;
use App\Support\FeedbackSubmissionGuard;
use App\Support\SupportChatPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PublicChatController extends Controller
{
    public function messages(Request $request, string $sessionId): JsonResponse
    {
        $afterId = max((int) $request->query('after_id', 0), 0);
        $limit = min(max((int) $request->query('limit', 120), 1), 500);
        $sid = trim($sessionId);

        $receipts = app(ChatMessageReceiptService::class);
        $readThrough = $receipts->parseThroughId($request->query('receipt_read_through_id'));
        $deliveryThrough = $receipts->parseThroughId($request->query('receipt_delivery_through_id'));
        if ($readThrough > 0) {
            $receipts->applyReadThrough($sid, $readThrough, true);
        }
        if ($deliveryThrough > 0) {
            $receipts->applyDeliveryThrough($sid, $deliveryThrough, true);
        }

        $baseQuery = fn () => ChatMessage::query()
            ->select([
                'id',
                'session_id',
                'visitor_id',
                'dedupe_key',
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
            ->when($afterId > 0, fn ($query) => $query->where('id', '>', $afterId))
            ->where('is_feedback', false)
            ->orderByRaw('COALESCE(sent_at, created_at) asc')
            ->orderBy('id')
            ->with('adminUser:id,name')
            ->limit($limit);

        $rows = $baseQuery()->get();

        if ($request->boolean('auto_mark_staff_receipts', true)) {
            $maxStaffId = (int) $rows->where('is_from_admin', true)->max('id');
            if ($maxStaffId > 0) {
                $n = $receipts->applyReadThrough($sid, $maxStaffId, true);
                $n += $receipts->applyDeliveryThrough($sid, $maxStaffId, true);
                if ($n > 0) {
                    $rows = $baseQuery()->get();
                }
            }
        }

        return response()->json([
            'ok' => true,
            'data' => $rows->map(fn (ChatMessage $row) => SupportChatPresenter::message($row)),
        ]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string|max:191',
            'visitor_id' => 'nullable|string|max:191',
            'message' => 'required|string|max:5000',
            'dedupe_key' => 'nullable|uuid',
        ]);

        if (! empty($data['dedupe_key'])) {
            $existing = ChatMessage::query()
                ->where('dedupe_key', $data['dedupe_key'])
                ->with('adminUser:id,name')
                ->first();
            if ($existing) {
                return response()->json([
                    'ok' => true,
                    'duplicate' => true,
                    'message' => SupportChatPresenter::message($existing),
                ], 200);
            }
        }

        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => trim($data['session_id'])],
            [
                'visitor_id' => $data['visitor_id'] ?? trim($data['session_id']),
                'mode' => 'ai',
                'ai_enabled' => true,
                'status' => SupportConversationHandoffService::STATUS_AI_ACTIVE,
            ],
        );

        SupportConversationHandoffService::normalizeAiActiveIfEligible($conv);
        $conv->refresh();

        if (VisitorMessageLimitService::isLocked($conv)) {
            return response()->json([
                'ok' => false,
                'locked' => true,
                'message' => VisitorMessageLimitService::LOCK_MESSAGE,
                'data' => array_merge(
                    SupportConversationHandoffService::handoffPayload($conv),
                    VisitorMessageLimitService::payload($conv),
                ),
            ], 429);
        }

        if (! blank($data['visitor_id'] ?? null) && blank($conv->visitor_id)) {
            $conv->visitor_id = $data['visitor_id'];
        }

        $clean = SupportChatPresenter::sanitizeBody($data['message']);
        if ($clean === '') {
            return response()->json(['message' => 'Invalid message.', 'errors' => ['message' => ['Message empty after sanitization']]], 422);
        }

        $message = ChatMessage::create([
            'support_conversation_id' => $conv->id,
            'visitor_id' => $data['visitor_id'] ?? null,
            'session_id' => $conv->session_id,
            'message' => $clean,
            'sender_type' => 'customer',
            'sender_name' => null,
            'is_from_visitor' => true,
            'is_from_admin' => false,
            'admin_user_id' => null,
            'dedupe_key' => $data['dedupe_key'] ?? null,
        ]);

        $conv->last_responder_type = 'customer';
        $conv->unread_admin = min(($conv->unread_admin ?? 0) + 1, 999);
        if ($clean !== '' && preg_match('/\b(agent|human|representative)\b/i', $clean)) {
            $conv->needs_human = true;
        }
        $conv->save();

        VisitorMessageLimitService::recordVisitorMessage($conv);
        $conv->refresh();

        $message->loadMissing('adminUser:id,name');

        app(NotificationCenter::class)->notifyStaffWebsiteChatMessage($conv, $message, $clean);

        return response()->json([
            'ok' => true,
            'message' => SupportChatPresenter::message($message),
            'visitor_limit' => VisitorMessageLimitService::payload($conv),
        ], 201);
    }

    public function conversationMeta(Request $request, string $sessionId): JsonResponse
    {
        $conv = SupportConversation::query()->where('session_id', $sessionId)->first();

        if (! $conv) {
            return response()->json([
                'ok' => true,
                'data' => null,
            ]);
        }

        return response()->json([
            'ok' => true,
            'data' => $conv ? array_merge(
                SupportConversationHandoffService::handoffPayload($conv),
                VisitorMessageLimitService::payload($conv),
                [
                    'guest_name' => $conv->guest_name,
                    'guest_email' => $conv->guest_email,
                    'customer_rating' => $conv->customer_rating,
                    'updated_at' => optional($conv->updated_at)?->toIso8601String(),
                ],
            ) : null,
        ]);
    }

    public function feedbackStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string|max:191',
            'rating' => 'required|integer|min:1|max:5',
            'subject' => 'nullable|string|max:191',
            'comment' => 'required|string|max:5000',
            'name' => 'nullable|string|max:191',
            'email' => 'nullable|email|max:191',
            'loan_type' => 'nullable|string|max:96',
            'consent_public_display' => 'nullable|boolean',
        ]);

        $comment = SupportChatPresenter::sanitizeBody($data['comment']);
        if ($comment === '') {
            return response()->json(['message' => 'Feedback comment invalid.'], 422);
        }

        $emailNorm = isset($data['email']) ? strtolower(trim((string) $data['email'])) : null;
        if ($emailNorm === '') {
            $emailNorm = null;
        }
        $borrowerId = null;
        if ($emailNorm) {
            $borrowerId = User::query()->where('email', $emailNorm)->value('id');
        }
        if (FeedbackSubmissionGuard::isRecentDuplicate($borrowerId ? (int) $borrowerId : null, $emailNorm, (int) $data['rating'], $comment)) {
            return response()->json([
                'ok' => true,
                'duplicate' => true,
                'message' => 'Thank you — we already recorded similar feedback recently.',
            ]);
        }

        $conv = SupportConversation::query()->where('session_id', trim($data['session_id']))->first();

        $supportFeedback = SupportChatFeedback::create([
            'support_conversation_id' => $conv?->id,
            'session_id' => trim($data['session_id']),
            'rating' => (int) $data['rating'],
            'comment' => $comment,
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
            'subject' => isset($data['subject']) ? trim((string) $data['subject']) : null,
            'status' => 'new',
            'is_from_sync' => false,
        ]);

        // Feedback Management Center: create a ticket mirror if migrated.
        if (DB::getSchemaBuilder()->hasTable('feedback_tickets')) {
            $fullName = isset($data['name']) ? trim((string) $data['name']) : null;
            if ($fullName === '') {
                $fullName = null;
            }

            FeedbackTicket::query()->updateOrCreate(
                ['support_chat_feedback_id' => $supportFeedback->id],
                [
                    'borrower_id' => $borrowerId,
                    'support_conversation_id' => $conv?->id,
                    'category' => 'General Feedback',
                    'priority' => 'Medium',
                    'status' => 'New',
                    'publication_status' => 'pending',
                    'featured' => false,
                    'source' => 'chatbot',
                    'consent_public_display' => (bool) ($data['consent_public_display'] ?? false),
                    'verified_borrower' => (bool) $borrowerId,
                    'loan_type' => isset($data['loan_type']) ? trim((string) $data['loan_type']) : null,
                    'subject' => isset($data['subject']) ? trim((string) $data['subject']) : null,
                    'message' => $comment,
                    'rating' => (int) $data['rating'],
                    'email' => $emailNorm ?: ($data['email'] ?? null),
                    'full_name' => $fullName,
                    'website_visible' => false,
                ],
            );
        }

        if ($conv) {
            $conv->customer_rating = (int) $data['rating'];
            $conv->rating_comment = mb_substr($comment, 0, 5000);
            $conv->rated_at = now();
            $conv->save();
        }

        $sessionIdTrim = trim($data['session_id']);
        $supportFeedbackId = (int) $supportFeedback->id;
        $rating = (int) $data['rating'];
        dispatch(function () use ($sessionIdTrim, $conv, $supportFeedbackId, $rating, $comment): void {
            try {
                app(NotificationCenter::class)->notifyStaff(
                    NotificationCenter::CATEGORY_FEEDBACK,
                    'visitor_feedback',
                    'Visitor feedback — '.$rating.'/5',
                    mb_substr($comment, 0, 500),
                    [
                        'session_id' => $sessionIdTrim,
                        'support_conversation_id' => $conv?->id,
                        'support_chat_feedback_id' => $supportFeedbackId,
                    ],
                    null,
                    [
                        'module' => NotificationCenter::MODULE_FEEDBACK,
                        'throttle_key' => 'feedback:'.$sessionIdTrim,
                        'throttle_max' => 6,
                        'throttle_decay_seconds' => 7200,
                    ],
                );
            } catch (\Throwable $e) {
                report($e);
            }
        })->afterResponse();

        return response()->json(['ok' => true]);
    }
}
