<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\PortalMessageSent;
use App\Events\SupportTicketUpdated;
use App\Models\PortalConversation;
use App\Models\PortalMessage;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Models\SupportTicketNote;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class AdminBorrowerCommunicationController extends Controller
{
    public function dashboard(): JsonResponse
    {
        $today = now()->startOfDay();

        return response()->json([
            'open_tickets' => SupportTicket::query()->whereIn('status', ['open', 'in_progress', 'waiting_for_borrower'])->count(),
            'unread_messages' => PortalConversation::query()->whereColumn('admin_last_seen_at', '<', 'last_message_at')->orWhereNull('admin_last_seen_at')->count(),
            'average_response_time' => '4m 20s',
            'resolved_today' => SupportTicket::query()->where('resolved_at', '>=', $today)->count(),
            'active_borrowers_online' => PortalConversation::query()->where('status', 'active')->where('last_message_at', '>=', now()->subMinutes(10))->count(),
            'staff_performance' => [],
        ]);
    }

    public function portalConversations(Request $request): JsonResponse
    {
        $query = PortalConversation::query()
            ->with(['borrower:id,name,email,phone,risk_level', 'loan:id,borrower_id,status,outstanding_balance'])
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('sender_type', 'borrower')->whereNull('seen_at')]);

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('subject', 'like', '%'.$search.'%')
                    ->orWhereHas('borrower', fn ($b) => $b->where('name', 'like', '%'.$search.'%')->orWhere('email', 'like', '%'.$search.'%'))
                    ->orWhereHas('loan', fn ($l) => $l->where('id', $search));
            });
        }

        if ($status = $request->query('status')) {
            $status === 'archived'
                ? $query->whereNotNull('archived_at')
                : $query->where('status', $status);
        }

        $rows = $query->orderByDesc('is_pinned')->orderByDesc('last_message_at')->paginate((int) $request->query('per_page', 30));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function portalMessages(Request $request, PortalConversation $conversation): JsonResponse
    {
        $perPage = max(10, min(100, (int) $request->query('per_page', 50)));
        $conversation->forceFill(['admin_last_seen_at' => now()])->save();

        $messages = $conversation->messages()
            ->select(['id', 'portal_conversation_id', 'sender_type', 'sender_id', 'body', 'attachments', 'sent_at', 'seen_at'])
            ->with('sender:id,name,email')
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->simplePaginate($perPage);

        return response()->json([
            'ok' => true,
            'data' => $messages->getCollection()->reverse()->values()->map(fn (PortalMessage $message) => [
                'id' => $message->id,
                'sender_type' => $message->sender_type,
                'sender_name' => $message->sender?->name,
                'body' => $message->body,
                'attachments' => $message->attachments ?? [],
                'sent_at' => optional($message->sent_at)->toIso8601String(),
                'seen_at' => optional($message->seen_at)->toIso8601String(),
            ]),
            'meta' => [
                'current_page' => $messages->currentPage(),
                'per_page' => $messages->perPage(),
                'has_more_pages' => $messages->hasMorePages(),
                'next_page_url' => $messages->nextPageUrl(),
            ],
        ]);
    }

    public function sendPortalMessage(Request $request, PortalConversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'body' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ]);

        $attachments = [];
        if ($request->hasFile('attachment')) {
            /** @var UploadedFile $file */
            $file = $request->file('attachment');
            $path = $file->store('portal-messages', 'public');
            $attachments[] = [
                'name' => $file->getClientOriginalName(),
                'url' => PublicStorageUrl::apiUrl($path),
                'path' => $path,
            ];
        }

        $message = PortalMessage::create([
            'portal_conversation_id' => $conversation->id,
            'sender_type' => 'admin',
            'sender_id' => $request->user()->id,
            'body' => trim((string) ($data['body'] ?? '')) ?: null,
            'attachments' => $attachments,
        ]);

        $conversation->forceFill(['status' => 'active', 'last_message_at' => now(), 'admin_last_seen_at' => now()])->save();
        PortalMessageSent::dispatch($message);

        return response()->json(['ok' => true, 'message' => $message], 201);
    }

    public function tickets(Request $request): JsonResponse
    {
        $query = SupportTicket::query()
            ->with(['borrower:id,name,email,phone,risk_level', 'loan:id,borrower_id,status,outstanding_balance', 'assignee:id,name,email'])
            ->withCount(['messages', 'attachments', 'notes']);

        if ($search = trim((string) $request->query('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('ticket_number', 'like', '%'.$search.'%')
                    ->orWhere('subject', 'like', '%'.$search.'%')
                    ->orWhereHas('borrower', fn ($b) => $b->where('name', 'like', '%'.$search.'%')->orWhere('email', 'like', '%'.$search.'%'))
                    ->orWhereHas('loan', fn ($l) => $l->where('id', $search));
            });
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($priority = $request->query('priority')) {
            $query->where('priority', $priority);
        }

        $rows = $query->orderByRaw("FIELD(priority, 'critical', 'high', 'medium', 'low')")
            ->orderByDesc('last_reply_at')
            ->orderByDesc('id')
            ->paginate((int) $request->query('per_page', 30));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function ticketMessages(Request $request, SupportTicket $ticket): JsonResponse
    {
        $perPage = max(10, min(100, (int) $request->query('per_page', 50)));
        $ticket->load(['attachments', 'notes.adminUser:id,name,email']);

        $messages = $ticket->messages()
            ->select(['id', 'support_ticket_id', 'sender_type', 'sender_id', 'body', 'is_internal', 'sent_at', 'seen_at'])
            ->with('sender:id,name,email')
            ->orderByDesc('sent_at')
            ->orderByDesc('id')
            ->simplePaginate($perPage);

        $ticket->setRelation('messages', $messages->getCollection()->reverse()->values());

        return response()->json([
            'ok' => true,
            'ticket' => $ticket,
            'meta' => [
                'current_page' => $messages->currentPage(),
                'per_page' => $messages->perPage(),
                'has_more_pages' => $messages->hasMorePages(),
                'next_page_url' => $messages->nextPageUrl(),
            ],
        ]);
    }

    public function replyTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate([
            'body' => 'required|string|max:10000',
            'is_internal' => 'sometimes|boolean',
        ]);

        $message = SupportTicketMessage::create([
            'support_ticket_id' => $ticket->id,
            'sender_type' => 'admin',
            'sender_id' => $request->user()->id,
            'body' => trim($data['body']),
            'is_internal' => (bool) ($data['is_internal'] ?? false),
        ]);

        $ticket->forceFill([
            'last_reply_at' => now(),
            'status' => $ticket->status === SupportTicket::STATUS_OPEN ? SupportTicket::STATUS_IN_PROGRESS : $ticket->status,
        ])->save();
        SupportTicketUpdated::dispatch($ticket->fresh());

        return response()->json(['ok' => true, 'message' => $message], 201);
    }

    public function updateTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate([
            'status' => 'sometimes|in:open,in_progress,waiting_for_borrower,resolved,closed',
            'priority' => 'sometimes|in:low,medium,high,critical',
            'assigned_to' => 'nullable|exists:users,id',
        ]);

        if (($data['status'] ?? null) === SupportTicket::STATUS_RESOLVED) {
            $data['resolved_at'] = now();
        }
        if (($data['status'] ?? null) === SupportTicket::STATUS_CLOSED) {
            $data['closed_at'] = now();
        }

        $ticket->fill($data)->save();
        SupportTicketUpdated::dispatch($ticket->fresh());

        return response()->json(['ok' => true, 'ticket' => $ticket->fresh(['borrower', 'loan', 'assignee'])]);
    }

    public function storeTicketNote(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['note' => 'required|string|max:10000']);

        $note = SupportTicketNote::create([
            'support_ticket_id' => $ticket->id,
            'admin_user_id' => $request->user()->id,
            'note' => trim($data['note']),
            'activity' => ['type' => 'internal_note'],
        ]);

        return response()->json(['ok' => true, 'note' => $note], 201);
    }
}
