<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\LeadContactMail;
use App\Models\Lead;
use App\Models\LeadMessage;
use App\Services\BrevoMailService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;

class AdminLeadController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Lead::query();
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        if ($search = $request->query('search')) {
            $q->where(function ($w) use ($search) {
                $w->where('name', 'like', '%'.$search.'%')
                    ->orWhere('email', 'like', '%'.$search.'%')
                    ->orWhere('organization', 'like', '%'.$search.'%');
            });
        }
        if ($request->filled('loan_type')) {
            $q->where('loan_type', $request->query('loan_type'));
        }
        $rows = $q->orderByDesc('last_message_at')->orderByDesc('id')->paginate((int) $request->query('per_page', 20));

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function show(Lead $lead): JsonResponse
    {
        $lead->load(['messages.adminUser']);
        $messages = $lead->messages->map(function (LeadMessage $m) {
            return [
                'id' => $m->id,
                'sender_type' => $m->sender_type,
                'message' => $m->message,
                'attachment_name' => $m->attachment_name,
                'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                'admin_name' => $m->adminUser?->name,
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

    public function destroy(Lead $lead): JsonResponse
    {
        $lead->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Send an email from the admin to the lead’s address.
     * Uses Brevo HTTP API when BREVO_API_KEY is set; otherwise Laravel Mail (SMTP/log).
     */
    public function sendEmail(Request $request, string $leadRef, BrevoMailService $brevo): JsonResponse
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
        $senderName = (string) ($request->user()->name ?? 'Amalgated Lending');

        try {
            if ($brevo->isConfigured()) {
                $html = view('mail.lead-contact', [
                    'subjectLine' => $data['subject'],
                    'leadName' => $leadName,
                    'bodyText' => $data['body'],
                    'senderName' => $senderName,
                ])->render();
                $brevo->sendHtml($to, $leadName, $data['subject'], $html);
            } else {
                Mail::to($to)->send(new LeadContactMail(
                    $data['subject'],
                    $leadName,
                    $data['body'],
                    $senderName,
                ));
            }
        } catch (\Throwable $e) {
            report($e);
            // Dev fallback: if SMTP/Brevo is unavailable, still persist the outgoing email to logs
            // so CRM actions don't hard-fail while env is being configured.
            if (! $brevo->isConfigured()) {
                try {
                    Mail::mailer('log')->to($to)->send(new LeadContactMail(
                        $data['subject'],
                        $leadName,
                        $data['body'],
                        $senderName,
                    ));

                    return response()->json([
                        'ok' => true,
                        'message' => 'Email logged (dev fallback). Configure BREVO_API_KEY or MAIL_* for real delivery.',
                    ]);
                } catch (\Throwable $fallbackError) {
                    report($fallbackError);
                }
            }

            return response()->json([
                'ok' => false,
                'message' => $brevo->isConfigured()
                    ? ('Brevo: '.($e->getMessage() ?: 'Could not send email.'))
                    : ('Could not send email. '.($e->getMessage() ?: 'Set BREVO_API_KEY or configure MAIL_* in .env.')),
            ], 500);
        }

        return response()->json(['ok' => true, 'message' => 'Email sent.']);
    }

    public function messages(Lead $lead): JsonResponse
    {
        $messages = $lead->messages()->with('adminUser')->get()->map(function (LeadMessage $m) {
            return [
                'id' => $m->id,
                'sender_type' => $m->sender_type,
                'message' => $m->message,
                'attachment_name' => $m->attachment_name,
                'attachment_url' => $m->attachment_path ? PublicStorageUrl::apiUrl($m->attachment_path) : null,
                'admin_name' => $m->adminUser?->name,
                'created_at' => optional($m->created_at)?->toIso8601String(),
            ];
        });

        return response()->json(['ok' => true, 'data' => $messages]);
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
                'created_at' => optional($msg->created_at)?->toIso8601String(),
            ],
        ], 201);
    }
}
