<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\FeedbackTicket;
use App\Models\SupportChatFeedback;
use App\Models\SupportConversation;
use App\Models\User;
use App\Services\NotificationCenter;
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

        $rows = ChatMessage::query()
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
                'created_at',
                'updated_at',
            ])
            ->where('session_id', $sessionId)
            ->when($afterId > 0, fn ($query) => $query->where('id', '>', $afterId))
            ->where('is_feedback', false)
            ->orderBy('created_at')
            ->orderBy('id')
            ->with('adminUser:id,name')
            ->limit($limit)
            ->get();

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
            if (ChatMessage::query()->where('dedupe_key', $data['dedupe_key'])->exists()) {
                $existing = ChatMessage::query()
                    ->where('dedupe_key', $data['dedupe_key'])
                    ->with('adminUser:id,name')
                    ->first();

                return response()->json([
                    'ok' => true,
                    'duplicate' => true,
                    'message' => $existing ? SupportChatPresenter::message($existing) : null,
                ], 200);
            }
        }

        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => trim($data['session_id'])],
            [
                'visitor_id' => $data['visitor_id'] ?? trim($data['session_id']),
                'mode' => 'ai',
                'status' => 'open',
            ],
        );

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

        $message->loadMissing('adminUser:id,name');

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_CRM_INQUIRY,
            'visitor_chat_message',
            'Visitor message — '.mb_substr($clean, 0, 72),
            mb_substr($clean, 0, 500),
            [
                'session_id' => $conv->session_id,
                'support_conversation_id' => $conv->id,
                'chat_message_id' => $message->id,
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_CRM,
                'throttle_key' => 'chat:'.$conv->session_id,
                'throttle_max' => 12,
                'throttle_decay_seconds' => 3600,
            ],
        );

        return response()->json([
            'ok' => true,
            'message' => SupportChatPresenter::message($message),
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
            'data' => [
                'session_id' => $conv->session_id,
                'mode' => $conv->mode,
                'status' => $conv->status,
                'needs_human' => (bool) $conv->needs_human,
                'assigned_to' => $conv->assigned_to,
                'guest_name' => $conv->guest_name,
                'guest_email' => $conv->guest_email,
                'customer_rating' => $conv->customer_rating,
                'updated_at' => optional($conv->updated_at)?->toIso8601String(),
            ],
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
        ]);

        $comment = SupportChatPresenter::sanitizeBody($data['comment']);
        if ($comment === '') {
            return response()->json(['message' => 'Feedback comment invalid.'], 422);
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
            $borrowerId = null;
            if (! empty($data['email'])) {
                $borrowerId = User::query()
                    ->where('email', trim((string) $data['email']))
                    ->value('id');
            }

            FeedbackTicket::query()->firstOrCreate(
                ['support_chat_feedback_id' => $supportFeedback->id],
                [
                    'borrower_id' => $borrowerId,
                    'support_conversation_id' => $conv?->id,
                    'category' => 'General Feedback',
                    'priority' => 'Medium',
                    'status' => 'New',
                    'subject' => isset($data['subject']) ? trim((string) $data['subject']) : null,
                    'message' => $comment,
                    'rating' => (int) $data['rating'],
                    'email' => $data['email'] ?? null,
                ],
            );
        }

        if ($conv) {
            $conv->customer_rating = (int) $data['rating'];
            $conv->rating_comment = mb_substr($comment, 0, 5000);
            $conv->rated_at = now();
            $conv->save();
        }

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_FEEDBACK,
            'visitor_feedback',
            'Visitor feedback — '.((int) $data['rating']).'/5',
            mb_substr($comment, 0, 500),
            [
                'session_id' => trim($data['session_id']),
                'support_conversation_id' => $conv?->id,
                'support_chat_feedback_id' => $supportFeedback->id,
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_FEEDBACK,
                'throttle_key' => 'feedback:'.trim($data['session_id']),
                'throttle_max' => 6,
                'throttle_decay_seconds' => 7200,
            ],
        );

        return response()->json(['ok' => true]);
    }
}
