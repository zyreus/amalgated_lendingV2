<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\IndexChatRequest;
use App\Http\Requests\Api\StoreChatRequest;
use App\Http\Requests\Api\UpdateChatRequest;
use App\Http\Resources\ChatResource;
use App\Models\Chat;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;

class ChatController extends Controller
{
    public function index(IndexChatRequest $request)
    {
        $this->authorize('viewAny', Chat::class);

        $user = $request->user();
        $validated = $request->validated();

        $chats = Chat::query()
            ->where('owner_user_id', $user->id)
            ->when($validated['contact_id'] ?? null, fn ($query, $contactId) => $query->where('contact_id', $contactId))
            ->when($validated['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
            ->when($validated['channel'] ?? null, fn ($query, $channel) => $query->where('channel', $channel))
            ->with([
                'contact:id,public_id,owner_user_id,name,email,phone,company,status',
                'latestMessage:id,public_id,chat_id,sender_type,sender_user_id,role,content,is_ai_generated,provider,model,parent_message_id,stream_request_key,metadata,created_at,updated_at',
            ])
            ->withCount('messages')
            ->orderByDesc('last_message_at')
            ->orderByDesc('updated_at')
            ->paginate((int) ($validated['per_page'] ?? 20))
            ->withQueryString();

        return ChatResource::collection($chats);
    }

    public function show(Chat $chat): ChatResource
    {
        $this->authorize('view', $chat);

        $chat->load([
            'contact:id,public_id,owner_user_id,name,email,phone,company,status',
            'latestMessage:id,public_id,chat_id,sender_type,sender_user_id,role,content,is_ai_generated,provider,model,parent_message_id,stream_request_key,metadata,created_at,updated_at',
        ])->loadCount('messages');

        return new ChatResource($chat);
    }

    public function store(StoreChatRequest $request): ChatResource
    {
        $this->authorize('create', Chat::class);

        $contact = Contact::query()
            ->where('owner_user_id', $request->user()->id)
            ->findOrFail($request->validated('contact_id'));

        $chat = Chat::create([
            ...$request->safe()->except('contact_id'),
            'contact_id' => $contact->id,
            'owner_user_id' => $request->user()->id,
        ]);

        Cache::forget($this->chatStatsCacheKey($request->user()->id));

        return new ChatResource($chat->fresh(['contact'])->loadCount('messages'));
    }

    public function update(UpdateChatRequest $request, Chat $chat): ChatResource
    {
        $this->authorize('update', $chat);

        $chat->fill($request->validated());
        $chat->save();

        Cache::forget($this->chatStatsCacheKey($request->user()->id));

        return new ChatResource($chat->fresh(['contact', 'latestMessage'])->loadCount('messages'));
    }

    public function destroy(Chat $chat): JsonResponse
    {
        $this->authorize('delete', $chat);

        $ownerId = (int) $chat->owner_user_id;
        $chat->delete();
        Cache::forget($this->chatStatsCacheKey($ownerId));

        return response()->json(['ok' => true]);
    }

    private function chatStatsCacheKey(int $userId): string
    {
        return "crm_chats:stats:user:{$userId}";
    }
}
