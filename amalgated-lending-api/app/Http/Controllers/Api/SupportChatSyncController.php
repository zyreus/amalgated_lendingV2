<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\SupportAiLog;
use App\Models\SupportAssignment;
use App\Models\SupportChatFeedback;
use App\Models\SupportConversation;
use App\Support\SupportChatPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class SupportChatSyncController extends Controller
{
    /** Trusted ingestion from chat-server (AI / agent / escalation). Visitor rows come from browser → PublicChatController. */
    public function syncMessage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string|max:191',
            'visitor_id' => 'nullable|string|max:191',
            'sender_type' => 'required|string|max:48',
            'sender_name' => 'nullable|string|max:191',
            'message' => 'required|string|max:5000',
            'dedupe_key' => 'nullable|uuid',
            'is_feedback' => 'sometimes|boolean',
            'ai_log.latency_ms' => 'sometimes|nullable|integer|min:0|max:600000',
            'ai_log.model' => 'sometimes|nullable|string|max:96',
            'ai_log.snippet' => 'sometimes|nullable|string|max:2000',
            'conversation_patch' => 'sometimes|nullable|array',
            'conversation_patch.mode' => 'sometimes|nullable|string|max:24',
            'conversation_patch.status' => 'sometimes|nullable|string|max:32',
            'conversation_patch.needs_human' => 'sometimes|nullable|boolean',
            'conversation_patch.last_responder_type' => 'sometimes|nullable|string|max:24',
            'conversation_patch.guest_name' => 'sometimes|nullable|string|max:191',
            'conversation_patch.guest_email' => 'sometimes|nullable|email|max:191',
            'conversation_patch.unread_increment' => 'sometimes|nullable|integer|min:1|max:50',
            'conversation_patch.assign_user_id' => 'sometimes|nullable|integer',
            'conversation_patch.escalated' => 'sometimes|nullable|boolean',
        ]);

        $body = SupportChatPresenter::sanitizeBody($data['message']);

        if ($body === '') {
            return response()->json(['ok' => false, 'message' => 'Empty message rejected.'], 422);
        }

        if (! empty($data['dedupe_key'])
            && ChatMessage::query()->where('dedupe_key', $data['dedupe_key'])->exists()) {
            return response()->json(['ok' => true, 'duplicate' => true]);
        }

        $conv = SupportConversation::query()->firstOrCreate(
            ['session_id' => trim($data['session_id'])],
            [
                'visitor_id' => $data['visitor_id'] ?? null,
                'mode' => 'ai',
                'status' => 'open',
            ],
        );

        if (! blank($data['visitor_id'] ?? null) && blank($conv->visitor_id)) {
            $conv->visitor_id = $data['visitor_id'];
            $conv->save();
        }

        $bools = SupportChatPresenter::booleansFromSenderType((string) $data['sender_type']);

        $msg = ChatMessage::create([
            'support_conversation_id' => $conv->id,
            'visitor_id' => $data['visitor_id'] ?? null,
            'session_id' => $conv->session_id,
            'message' => $body,
            'sender_type' => strtolower((string) $data['sender_type']),
            'sender_name' => $data['sender_name'] ?? null,
            'is_from_visitor' => $bools['is_from_visitor'],
            'is_from_admin' => $bools['is_from_admin'],
            'admin_user_id' => null,
            'dedupe_key' => $data['dedupe_key'] ?? null,
            'is_feedback' => (bool) ($data['is_feedback'] ?? false),
        ]);

        $st = strtolower((string) ($msg->sender_type ?? ''));
        if ($st === 'system') {
            $conv->last_responder_type = 'system';
        } elseif ($st === 'ai') {
            $conv->last_responder_type = 'ai';
        } elseif ($st === 'admin') {
            $conv->last_responder_type = 'admin';
            $conv->mode = $conv->mode ?: 'human';
        } elseif (in_array($st, ['customer', 'visitor', 'user'], true)) {
            $conv->last_responder_type = 'customer';
        }

        $this->applyConversationPatch($conv, $data['conversation_patch'] ?? null);
        $conv->save();

        if (! empty($data['ai_log']) && ($msg->sender_type === 'ai')) {
            SupportAiLog::create([
                'support_conversation_id' => $conv->id,
                'latency_ms' => $data['ai_log']['latency_ms'] ?? null,
                'model' => $data['ai_log']['model'] ?? null,
                'response_chars' => mb_strlen($body),
                'snippet' => $data['ai_log']['snippet'] ?? mb_substr($body, 0, 480),
            ]);
        }

        $msg->loadMissing('adminUser:id,name');

        return response()->json([
            'ok' => true,
            'message' => SupportChatPresenter::message($msg),
        ], 201);
    }

    public function syncFeedback(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'required|string|max:191',
            'rating' => 'required|integer|min:1|max:5',
            'subject' => 'sometimes|nullable|string|max:191',
            'comment' => 'required|string|max:5000',
            'name' => 'sometimes|nullable|string|max:191',
            'email' => 'sometimes|nullable|email|max:191',
        ]);

        $comment = SupportChatPresenter::sanitizeBody($data['comment']);
        if ($comment === '') {
            return response()->json(['ok' => false, 'message' => 'Comment empty.'], 422);
        }

        $conv = SupportConversation::query()->where('session_id', $data['session_id'])->first();

        SupportChatFeedback::create([
            'support_conversation_id' => $conv?->id,
            'session_id' => trim($data['session_id']),
            'rating' => (int) $data['rating'],
            'comment' => $comment,
            'name' => $data['name'] ?? null,
            'email' => $data['email'] ?? null,
            'subject' => isset($data['subject']) ? trim((string) $data['subject']) : null,
            'status' => 'new',
            'is_from_sync' => true,
        ]);

        if ($conv) {
            $conv->customer_rating = (int) $data['rating'];
            $conv->rated_at = Carbon::now();
            $conv->save();
        }

        return response()->json(['ok' => true], 201);
    }

    /**
     * @param  array<string, mixed>|null  $patch
     */
    private function applyConversationPatch(SupportConversation $conv, ?array $patch): void
    {
        if (! is_array($patch) || empty($patch)) {
            return;
        }

        if (! empty($patch['mode'])) {
            $conv->mode = strtolower((string) $patch['mode']);
        }

        if (! empty($patch['status'])) {
            $conv->status = strtolower((string) $patch['status']);
        }

        if (array_key_exists('needs_human', $patch)) {
            $conv->needs_human = (bool) $patch['needs_human'];
        }

        if (! empty($patch['guest_name'])) {
            $conv->guest_name = (string) $patch['guest_name'];
        }

        if (! empty($patch['guest_email'])) {
            $conv->guest_email = (string) $patch['guest_email'];
        }

        if (! empty($patch['last_responder_type'])) {
            $conv->last_responder_type = strtolower((string) $patch['last_responder_type']);
        }

        $incUnread = isset($patch['unread_increment']) ? (int) $patch['unread_increment'] : 0;
        if ($incUnread > 0) {
            $conv->unread_admin = min(($conv->unread_admin ?? 0) + $incUnread, 999);
        }

        if (! empty($patch['assign_user_id'])) {
            $uid = (int) $patch['assign_user_id'];
            $conv->assigned_to = $uid;
            SupportAssignment::query()->create([
                'support_conversation_id' => $conv->id,
                'user_id' => $uid,
                'assigned_at' => Carbon::now(),
            ]);
        }

        if (! empty($patch['escalated'])) {
            $conv->escalated_at = $conv->escalated_at ?? Carbon::now();
            $conv->needs_human = true;
            $conv->mode = 'human';
        }
    }
}
