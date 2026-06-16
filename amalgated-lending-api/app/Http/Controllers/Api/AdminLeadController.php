<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\LeadContactMail;
use App\Models\Lead;
use App\Models\LeadMessage;
use App\Services\SmtpMailService;
use App\Services\TransactionalMailSender;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class AdminLeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Lead::query();
        if ($status = $request->query('status')) {
            $status === 'archived'
                ? $q->where('is_archived', true)
                : $q->where('status', $status)->where(function ($w) {
                    $w->where('is_archived', false)->orWhereNull('is_archived');
                });
        }
        if ($search = $request->query('search')) {
            $q->where(function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('organization', 'like', '%'.$search.'%')
                    ->orWhere('phone', 'like', '%'.$search.'%');
            });
        }
        if ($request->filled('loan_type')) {
            $q->where('loan_type', $request->query('loan_type'));
        }
        if ($request->filled('exclude_loan_type')) {
            $excludedLoanTypes = collect(explode(',', (string) $request->query('exclude_loan_type')))
                ->map(fn ($value) => trim($value))
                ->filter()
                ->values()
                ->all();
            if (count($excludedLoanTypes) > 1) {
                $q->whereNotIn('loan_type', $excludedLoanTypes);
            } elseif (count($excludedLoanTypes) === 1) {
                $q->where('loan_type', '!=', $excludedLoanTypes[0]);
            }
        }
        $rows = $q->orderByDesc('last_message_at')->orderByDesc('id')->paginate((int) $request->query('per_page', 20));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function show(Lead $lead): JsonResponse
    {
        $messages = $this->leadMessagesQuery($lead)
            ->limit(50)
            ->get()
            ->reverse()
            ->values()
            ->map(function (LeadMessage $m) {
                return [
                    'id' => $m->id,
                    'sender_type' => $m->sender_type,
                    'message' => $m->message,
                    'attachment_name' => $m->attachment_name,
                    'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                    'admin_name' => $m->adminUser?->name,
                    'sent_at' => optional($m->sent_at)?->toIso8601String(),
                    'delivered_at' => optional($m->delivered_at)?->toIso8601String(),
                    'read_at' => optional($m->read_at)?->toIso8601String(),
                    'created_at' => optional($m->created_at)?->toIso8601String(),
                ];
            });

        return response()->json(['ok' => true, 'lead' => $lead, 'messages' => $messages]);
    }

    public function update(Request $request, Lead $lead): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:new,ongoing,closed',
        ]);
        $lead->status = $data['status'];
        $lead->save();

        return response()->json(['ok' => true, 'lead' => $lead->fresh()]);
    }

    public function destroy(Request $request, Lead $lead): JsonResponse
    {
        $this->authorizeThreadDelete($request);
        $lead->delete();

        return response()->json(['ok' => true]);
    }

    public function markRead(Request $request, Lead $lead): JsonResponse
    {
        $lead->forceFill([
            'unread_count' => 0,
            'last_read_at' => now(),
        ])->save();

        return response()->json([
            'ok' => true,
            'message' => 'Conversation marked as read',
            'lead' => $lead->fresh(),
        ]);
    }

    public function markUnread(Request $request, Lead $lead): JsonResponse
    {
        $lead->forceFill([
            'unread_count' => max(1, (int) ($lead->unread_count ?? 0)),
            'last_read_at' => null,
        ])->save();

        return response()->json([
            'ok' => true,
            'message' => 'Conversation marked as unread',
            'lead' => $lead->fresh(),
        ]);
    }

    public function archive(Request $request, Lead $lead): JsonResponse
    {
        $lead->forceFill([
            'is_archived' => true,
            'archived_at' => now(),
            'status' => 'closed',
        ])->save();

        return response()->json([
            'ok' => true,
            'message' => 'Conversation archived',
            'lead' => $lead->fresh(),
        ]);
    }

    public function unarchive(Request $request, Lead $lead): JsonResponse
    {
        $lead->forceFill([
            'is_archived' => false,
            'archived_at' => null,
            'status' => 'ongoing',
        ])->save();

        return response()->json([
            'ok' => true,
            'message' => 'Conversation unarchived',
            'lead' => $lead->fresh(),
        ]);
    }

    /**
     * Send an email from the admin to the lead’s address.
     * Sends CRM email to a lead via Google Workspace SMTP.
     */
    public function sendEmail(Request $request, string $leadRef, TransactionalMailSender $mail, SmtpMailService $smtp): JsonResponse
    {
        $data = $request->validate([
            'subject' => 'required|string|max:200',
            'body' => 'required|string|max:20000',
            'email' => 'nullable|email|max:191',
            'name' => 'nullable|string|max:191',
        ]);

        $lead = null;
        if (ctype_digit((string) $leadRef)) {
            $lead = Lead::query()->find((int) $leadRef);
            if (! $lead) {
                // Some UIs may pass borrower/user id instead of lead id.
                $lead = Lead::query()->where('user_id', (int) $leadRef)->latest('id')->first();
            }
        }
        if (! $lead && ! empty($data['email'])) {
            $lead = Lead::query()->where('email', trim((string) $data['email']))->latest('id')->first();
        }

        $to = trim((string) ($data['email'] ?? $lead?->email ?? ''));
        if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return response()->json([
                'ok' => false,
                'message' => 'This lead has no valid email address.',
            ], 422);
        }

        $leadName = trim((string) ($data['name'] ?? $lead?->name ?? '')) ?: 'there';
        $senderName = (string) ($request->user()->name ?? 'Amalgated Lending Inc.');

        $mailable = new LeadContactMail(
            $data['subject'],
            $leadName,
            $data['body'],
            $senderName,
        );

        try {
            $result = $mail->sendHtmlMailable($mailable, $to, $leadName, $data['subject'], [
                'flow' => 'crm_lead_email',
                'lead_ref' => $leadRef,
            ]);
            if (! ($result['ok'] ?? false)) {
                if (! $smtp->isConfigured()) {
                    try {
                        Mail::mailer('log')->to($to)->send(clone $mailable);

                        return response()->json([
                            'ok' => true,
                            'message' => 'Email logged (dev fallback). Configure MAIL_* in .env for Google Workspace SMTP delivery.',
                        ]);
                    } catch (\Throwable $fallbackError) {
                        report($fallbackError);
                    }
                }

                return response()->json([
                    'ok' => false,
                    'message' => (string) ($result['detail'] ?? 'Could not send email. Check MAIL_* in .env.'),
                ], 500);
            }
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'ok' => false,
                'message' => $e->getMessage() ?: 'Could not send email.',
            ], 500);
        }

        return response()->json(['ok' => true, 'message' => 'Email sent.']);
    }

    public function messages(Request $request, Lead $lead): JsonResponse
    {
        $perPage = max(10, min(100, (int) $request->query('per_page', 50)));
        $rows = $this->leadMessagesQuery($lead)->simplePaginate($perPage);

        $messages = $rows->getCollection()->reverse()->values()->map(function (LeadMessage $m) {
            return [
                'id' => $m->id,
                'sender_type' => $m->sender_type,
                'message' => $m->message,
                'attachment_name' => $m->attachment_name,
                'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                'admin_name' => $m->adminUser?->name,
                'sent_at' => optional($m->sent_at)?->toIso8601String(),
                'delivered_at' => optional($m->delivered_at)?->toIso8601String(),
                'read_at' => optional($m->read_at)?->toIso8601String(),
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

    private function leadMessagesQuery(Lead $lead)
    {
        return $lead->messages()
            ->select([
                'id',
                'lead_id',
                'sender_type',
                'admin_user_id',
                'message',
                'attachment_name',
                'attachment_path',
                'sent_at',
                'delivered_at',
                'read_at',
                'created_at',
            ])
            ->with('adminUser:id,name')
            ->orderByDesc('sent_at')
            ->orderByDesc('id');
    }

    public function sendMessage(Request $request, Lead $lead): JsonResponse
    {
        $data = $request->validate([
            'message' => 'nullable|string|max:5000',
            'attachment' => 'nullable|file|max:5120|mimes:jpg,jpeg,png,pdf,doc,docx',
        ]);
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
            Log::info('Admin lead chat attachment stored.', [
                'lead_id' => $lead->id,
                'admin_user_id' => $request->user()->id,
                'attachment_path' => $path,
                'disk' => 'public',
                'full_path' => Storage::disk('public')->path($path),
            ]);
        }

        $msg = LeadMessage::create([
            'lead_id' => $lead->id,
            'sender_type' => 'admin',
            'admin_user_id' => $request->user()->id,
            'message' => trim((string) ($data['message'] ?? '')) ?: null,
            'attachment_path' => $path,
            'attachment_name' => $name,
        ]);
        $lead->last_message_at = now();
        $lead->forceFill([
            'unread_count' => 0,
            'last_read_at' => now(),
            'is_archived' => false,
            'archived_at' => null,
        ]);
        if ($lead->status === 'new') {
            $lead->status = 'ongoing';
        }
        $lead->save();

        return response()->json([
            'ok' => true,
            'message' => [
                'id' => $msg->id,
                'sender_type' => $msg->sender_type,
                'message' => $msg->message,
                'attachment_name' => $msg->attachment_name,
                'attachment_url' => $msg->attachment_path ? PublicStorageUrl::apiUrl($msg->attachment_path) : null,
                'admin_name' => $request->user()->name,
                'sent_at' => optional($msg->sent_at)?->toIso8601String(),
                'delivered_at' => optional($msg->delivered_at)?->toIso8601String(),
                'read_at' => optional($msg->read_at)?->toIso8601String(),
                'created_at' => optional($msg->created_at)?->toIso8601String(),
            ],
        ], 201);
    }

    private function authorizeThreadDelete(Request $request): void
    {
        $user = $request->user();
        if (
            $user
            && (
                $user->hasPermission('users.manage')
                || $user->hasPermission('roles.manage')
                || $user->hasPermission('borrowers.delete')
            )
        ) {
            return;
        }

        abort(403, 'Only system administrators may delete conversations.');
    }
}
