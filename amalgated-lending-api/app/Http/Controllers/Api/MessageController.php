<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\IndexMessageRequest;
use App\Http\Requests\Api\StoreMessageRequest;
use App\Http\Requests\Api\StreamAiMessageRequest;
use App\Http\Resources\MessageResource;
use App\Jobs\ProcessAiChatReply;
use App\Models\Chat;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MessageController extends Controller
{
    public function index(IndexMessageRequest $request, Chat $chat): JsonResponse
    {
        $this->authorize('view', $chat);

        $validated = $request->validated();
        $limit = (int) ($validated['limit'] ?? 30);

        $messages = Message::query()
            ->where('chat_id', $chat->id)
            ->with('sender:id,name,email')
            ->when($validated['after_id'] ?? null, fn ($query, $afterId) => $query->where('id', '>', $afterId))
            ->when($validated['before_id'] ?? null, fn ($query, $beforeId) => $query->where('id', '<', $beforeId))
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();

        $chat->forceFill(['agent_unread_count' => 0])->saveQuietly();

        return response()->json([
            'ok' => true,
            'data' => MessageResource::collection($messages),
            'meta' => [
                'limit' => $limit,
                'has_more' => $messages->count() >= $limit,
            ],
        ]);
    }

    public function store(StoreMessageRequest $request, Chat $chat): JsonResponse
    {
        $this->authorize('view', $chat);

        $validated = $request->validated();
        $senderType = $validated['sender_type'] ?? Message::SENDER_AGENT;

        $message = Message::create([
            'chat_id' => $chat->id,
            'sender_type' => $senderType,
            'sender_user_id' => $senderType === Message::SENDER_AGENT ? $request->user()->id : null,
            'role' => $validated['role'] ?? ($senderType === Message::SENDER_AGENT ? 'assistant' : 'user'),
            'content' => $validated['content'],
            'parent_message_id' => $validated['parent_message_id'] ?? null,
            'stream_request_key' => $validated['stream_request_key'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
            'is_ai_generated' => $senderType === Message::SENDER_AI,
        ]);

        $chat->forceFill([
            'last_message_id' => $message->id,
            'last_message_at' => $message->created_at,
            'customer_unread_count' => $senderType === Message::SENDER_AGENT ? $chat->customer_unread_count + 1 : $chat->customer_unread_count,
            'agent_unread_count' => $senderType === Message::SENDER_CUSTOMER ? $chat->agent_unread_count + 1 : $chat->agent_unread_count,
        ])->save();

        Cache::forget($this->chatStatsCacheKey((int) $chat->owner_user_id));

        if (! empty($validated['request_ai_reply'])) {
            ProcessAiChatReply::dispatch($chat->id, $message->id, [
                'requested_by_user_id' => $request->user()->id,
                'stream_request_key' => $validated['stream_request_key'] ?? null,
            ]);
        }

        return response()->json([
            'ok' => true,
            'data' => new MessageResource($message->load('sender:id,name,email')),
        ], 201);
    }

    public function streamAi(StreamAiMessageRequest $request, Chat $chat): StreamedResponse
    {
        $this->authorize('view', $chat);

        $requestKey = $request->validated('stream_request_key');
        $prompt = trim((string) $request->validated('message'));

        return response()->stream(function () use ($requestKey, $prompt, $chat): void {
            echo "event: start\n";
            echo 'data: '.json_encode([
                'chat_public_id' => $chat->public_id,
                'stream_request_key' => $requestKey,
            ])."\n\n";
            @ob_flush();
            flush();

            $chunks = str_split($prompt, max(1, (int) ceil(strlen($prompt) / 3)));

            foreach ($chunks as $index => $chunk) {
                echo "event: token\n";
                echo 'data: '.json_encode([
                    'index' => $index,
                    'delta' => $chunk,
                ])."\n\n";
                @ob_flush();
                flush();
                usleep(120000);
            }

            echo "event: done\n";
            echo 'data: '.json_encode([
                'stream_request_key' => $requestKey,
                'note' => 'Wire this endpoint to a provider stream and persist the final assistant message after completion.',
            ])."\n\n";
            @ob_flush();
            flush();
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    private function chatStatsCacheKey(int $userId): string
    {
        return "crm_chats:stats:user:{$userId}";
    }
}
