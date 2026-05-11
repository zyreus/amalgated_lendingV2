<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeedbackTicket;
use App\Models\User;
use App\Services\NotificationCenter;
use App\Support\FeedbackSubmissionGuard;
use App\Support\SupportChatPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Public website feedback form (no chat session). Creates CRM tickets with publication = pending.
 */
class PublicFeedbackSubmitController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        abort_unless(Schema::hasTable('feedback_tickets'), 503, 'Feedback ticketing is not available.');

        $data = $request->validate([
            'full_name' => 'required|string|max:191',
            'email' => 'required|email|max:191',
            'feedback_message' => 'required|string|max:5000',
            'rating' => 'required|integer|min:1|max:5',
            'loan_type' => 'nullable|string|max:96',
            'display_name' => 'nullable|string|max:120',
            'consent_public_display' => 'nullable|boolean',
            'borrower_id' => 'nullable|integer|exists:users,id',
            'website_url' => 'nullable|string|max:255',
        ]);

        if (filled($data['website_url'] ?? null)) {
            return response()->json(['ok' => true, 'message' => 'Thank you for your feedback.'], 201);
        }

        $message = SupportChatPresenter::sanitizeBody($data['feedback_message']);
        if ($message === '') {
            return response()->json(['ok' => false, 'message' => 'Feedback message invalid.'], 422);
        }

        $email = strtolower(trim((string) $data['email']));
        $borrowerId = isset($data['borrower_id']) ? (int) $data['borrower_id'] : null;
        if (! $borrowerId) {
            $borrowerId = User::query()->where('email', $email)->value('id');
        }

        if (FeedbackSubmissionGuard::isRecentDuplicate($borrowerId ? (int) $borrowerId : null, $email, (int) $data['rating'], $message)) {
            return response()->json([
                'ok' => true,
                'duplicate' => true,
                'message' => 'Thank you — we already recorded similar feedback recently.',
            ], 201);
        }

        $publicLabel = isset($data['display_name']) ? trim((string) $data['display_name']) : '';

        $ticket = FeedbackTicket::query()->create([
            'borrower_id' => $borrowerId,
            'support_chat_feedback_id' => null,
            'support_conversation_id' => null,
            'category' => 'General Feedback',
            'priority' => 'Medium',
            'status' => 'New',
            'publication_status' => 'pending',
            'featured' => false,
            'source' => 'website',
            'consent_public_display' => (bool) ($data['consent_public_display'] ?? false),
            'verified_borrower' => (bool) $borrowerId,
            'loan_type' => isset($data['loan_type']) ? trim((string) $data['loan_type']) : null,
            'subject' => 'Website feedback — '.Str::limit(trim((string) $data['full_name']), 80, ''),
            'message' => $message,
            'rating' => (int) $data['rating'],
            'email' => $email,
            'full_name' => trim((string) $data['full_name']),
            'public_author_label' => $publicLabel !== '' ? Str::limit($publicLabel, 120, '') : null,
            'website_visible' => false,
        ]);

        $ticketId = (int) $ticket->id;
        dispatch(function () use ($ticketId): void {
            try {
                $t = FeedbackTicket::query()->find($ticketId);
                if (! $t) {
                    return;
                }
                app(NotificationCenter::class)->notifyStaff(
                    NotificationCenter::CATEGORY_FEEDBACK,
                    'website_feedback',
                    'New website feedback — '.((int) $t->rating).'/5',
                    mb_substr((string) $t->message, 0, 500),
                    ['feedback_ticket_id' => $t->id],
                    null,
                    [
                        'module' => NotificationCenter::MODULE_FEEDBACK,
                        'throttle_key' => 'website-feedback:'.$t->id,
                        'throttle_max' => 2,
                        'throttle_decay_seconds' => 3600,
                    ],
                );
            } catch (\Throwable $e) {
                report($e);
            }
        })->afterResponse();

        return response()->json(['ok' => true, 'id' => $ticket->id], 201);
    }
}
