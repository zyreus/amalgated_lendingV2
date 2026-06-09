<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPublicFormAcknowledgementJob;
use App\Models\Lead;
use App\Models\LeadMessage;
use App\Services\NotificationCenter;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;

class PublicLeadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'organization' => 'nullable|string|max:255',
            'loan_type' => 'nullable|string|max:255',
            'message' => 'required|string|max:5000',
            'source' => 'nullable|string|max:120',
        ]);

        $source = trim((string) ($data['source'] ?? ''));
        if ($source === '' && self::isNewsletterSignup($data['message'], $data['name'])) {
            $source = 'newsletter';
        }

        $lead = Lead::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'organization' => $data['organization'] ?? null,
            'loan_type' => $data['loan_type'] ?? null,
            'source' => $source !== '' ? $source : null,
            'source_page' => $request->headers->get('Referer'),
            'status' => 'new',
            'initial_message' => $data['message'],
            'chat_token' => Str::random(40),
            'last_message_at' => now(),
        ]);

        LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'borrower',
            'message' => $data['message'],
        ]);

        $formType = ($source === 'newsletter' || self::isNewsletterSignup($data['message'], $data['name']))
            ? 'newsletter'
            : 'contact';

        app(NotificationCenter::class)->notifyStaff(
            NotificationCenter::CATEGORY_CRM_INQUIRY,
            'public_lead',
            'New lead — '.$data['name'],
            mb_substr(trim($data['message']), 0, 240),
            [
                'lead_id' => $lead->id,
                'email' => $data['email'],
            ],
            null,
            [
                'module' => NotificationCenter::MODULE_CRM,
                'dedupe_key' => 'public_lead:'.$lead->id,
            ],
        );

        SendPublicFormAcknowledgementJob::dispatch(
            $data['email'],
            $data['name'],
            $formType,
            mb_substr(trim($data['message']), 0, 200),
            ['reference_id' => $lead->id, 'lead_id' => $lead->id],
        );

        return response()->json([
            'ok' => true,
            'lead' => [
                'id' => $lead->id,
                'name' => $lead->name,
                'email' => $lead->email,
                'status' => $lead->status,
            ],
            'chat_token' => $lead->chat_token,
        ], 201);
    }

    private static function isNewsletterSignup(string $message, string $name): bool
    {
        $msg = mb_strtolower($message);
        if (str_contains($msg, 'newsletter') || str_contains($msg, 'product updates')) {
            return true;
        }

        return mb_strtolower(trim($name)) === 'newsletter subscriber';
    }

    public function messages(Request $request, Lead $lead): JsonResponse
    {
        $token = (string) $request->query('token', '');
        if ($token === '' || ! hash_equals((string) $lead->chat_token, $token)) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized lead chat access.'], 403);
        }

        $perPage = max(10, min(100, (int) $request->query('per_page', 50)));
        $rows = $lead->messages()
            ->select(['id', 'lead_id', 'sender_type', 'message', 'attachment_name', 'attachment_path', 'created_at'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->simplePaginate($perPage);

        $messages = $rows->getCollection()->reverse()->values()->map(function (LeadMessage $m) {
            return [
                'id' => $m->id,
                'sender_type' => $m->sender_type,
                'message' => $m->message,
                'attachment_name' => $m->attachment_name,
                'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                'created_at' => optional($m->created_at)?->toIso8601String(),
            ];
        });

        return response()->json([
            'ok' => true,
            'data' => $messages,
            'meta' => [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'has_more_pages' => $rows->hasMorePages(),
                'next_page_url' => $rows->nextPageUrl(),
            ],
        ]);
    }

    public function sendMessage(Request $request, Lead $lead): JsonResponse
    {
        $data = $request->validate([
            'token' => 'required|string',
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ]);
        if (! hash_equals((string) $lead->chat_token, (string) $data['token'])) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized lead chat access.'], 403);
        }
        if (! $request->hasFile('attachment') && trim((string) ($data['message'] ?? '')) === '') {
            return response()->json(['ok' => false, 'message' => 'Message or attachment is required.'], 422);
        }

        $path = null;
        $name = null;
        if ($request->hasFile('attachment')) {
            /** @var UploadedFile $file */
            $file = $request->file('attachment');
            $path = $file->store('lead-chat', 'public');
            $name = $file->getClientOriginalName();
        }

        $msg = LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'borrower',
            'message' => trim((string) ($data['message'] ?? '')) ?: null,
            'attachment_path' => $path,
            'attachment_name' => $name,
        ]);
        $lead->last_message_at = now();
        $lead->status = $lead->status === 'closed' ? 'ongoing' : $lead->status;
        $lead->save();

        return response()->json([
            'ok' => true,
            'message' => [
                'id' => $msg->id,
                'sender_type' => $msg->sender_type,
                'message' => $msg->message,
                'attachment_name' => $msg->attachment_name,
                'attachment_url' => $msg->attachment_path ? PublicStorageUrl::apiUrl($msg->attachment_path) : null,
                'created_at' => optional($msg->created_at)?->toIso8601String(),
            ],
        ], 201);
    }
}
