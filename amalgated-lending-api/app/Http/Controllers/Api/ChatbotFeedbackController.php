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

class ChatbotFeedbackController extends Controller
{
    /**
     * Unified borrower / visitor feedback intake for chatbot and automation flows.
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless(Schema::hasTable('feedback_tickets'), 503, 'Feedback ticketing is not available.');

        $data = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'message' => 'required|string|max:5000',
            'loan_type' => 'nullable|string|max:96',
            'consent_public_display' => 'nullable|boolean',
            'session_id' => 'nullable|string|max:191',
            'name' => 'nullable|string|max:191',
            'email' => 'nullable|email|max:191',
            'borrower_id' => 'nullable|integer|exists:users,id',
            'subject' => 'nullable|string|max:191',
            'source' => 'nullable|string|in:chatbot,website,manual',
        ]);

        $message = SupportChatPresenter::sanitizeBody($data['message']);
        if ($message === '') {
            return response()->json(['message' => 'Feedback message invalid.'], 422);
        }

        $borrowerId = isset($data['borrower_id']) ? (int) $data['borrower_id'] : null;
        $email = isset($data['email']) ? trim((string) $data['email']) : null;
        if (! $borrowerId && $email) {
            $borrowerId = User::query()->where('email', $email)->value('id');
        }

        if (FeedbackSubmissionGuard::isRecentDuplicate($borrowerId, $email, (int) $data['rating'], $message)) {
            return response()->json(['ok' => true, 'duplicate' => true, 'message' => 'Thank you — we already recorded similar feedback recently.']);
        }

        $fullName = FeedbackTicket::normalizeFullName($data['name'] ?? null);

        $ticket = FeedbackTicket::query()->create([
            'borrower_id' => $borrowerId,
            'support_chat_feedback_id' => null,
            'support_conversation_id' => null,
            'category' => 'General Feedback',
            'priority' => 'Medium',
            'status' => 'New',
            'publication_status' => 'pending',
            'featured' => false,
            'source' => $data['source'] ?? 'chatbot',
            'consent_public_display' => (bool) ($data['consent_public_display'] ?? false),
            'verified_borrower' => (bool) $borrowerId,
            'loan_type' => isset($data['loan_type']) ? trim((string) $data['loan_type']) : null,
            'subject' => isset($data['subject']) ? trim((string) $data['subject']) : null,
            'message' => $message,
            'rating' => (int) $data['rating'],
            'email' => $email,
            'full_name' => $fullName,
            'website_visible' => false,
        ]);

        $ticketId = (int) $ticket->id;
        $sessionIdTrim = isset($data['session_id']) ? trim((string) $data['session_id']) : null;
        if ($sessionIdTrim === '') {
            $sessionIdTrim = null;
        }
        dispatch(function () use ($ticketId, $borrowerId, $email, $request, $sessionIdTrim): void {
            try {
                $t = FeedbackTicket::query()->find($ticketId);
                if (! $t) {
                    return;
                }
                app(NotificationCenter::class)->notifyStaff(
                    NotificationCenter::CATEGORY_FEEDBACK,
                    'chatbot_feedback',
                    'New feedback — '.((int) $t->rating).'/5',
                    mb_substr((string) $t->message, 0, 500),
                    [
                        'feedback_ticket_id' => $t->id,
                        'session_id' => $sessionIdTrim,
                    ],
                    null,
                    [
                        'module' => NotificationCenter::MODULE_FEEDBACK,
                        'throttle_key' => 'chatbot-feedback:'.($borrowerId ?: $email ?: $request->ip()),
                        'throttle_max' => 8,
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
