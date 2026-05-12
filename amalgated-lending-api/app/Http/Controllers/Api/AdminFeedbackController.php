<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeedbackAnalytics;
use App\Models\FeedbackAuditLog;
use App\Models\FeedbackTicket;
use App\Mail\FeedbackTestimonialApprovedMail;
use App\Services\TransactionalMailSender;
use App\Support\SupportChatPresenter;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class AdminFeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureTicketsAvailable();

        $q = FeedbackTicket::query()
            ->with([
                'borrower:id,name,email,phone,role,risk_level,credit_score,created_at',
                'assignedStaff:id,name,email,role',
            ]);

        if ($search = trim((string) $request->query('search', ''))) {
            $s = '%'.$search.'%';
            $q->where(function ($w) use ($s) {
                $w->where('subject', 'like', $s)
                    ->orWhere('message', 'like', $s)
                    ->orWhere('email', 'like', $s)
                    ->orWhere('contact_number', 'like', $s)
                    ->orWhere('location', 'like', $s);
            });
        }

        foreach ([
            'priority' => 'priority',
            'status' => 'status',
            'department' => 'department',
            'assigned_staff' => 'assigned_staff_id',
            'borrower_id' => 'borrower_id',
            'location' => 'location',
            'payment_status' => 'payment_status',
            'risk_level' => 'risk_level',
        ] as $param => $col) {
            if ($request->filled($param)) {
                $q->where($col, (string) $request->query($param));
            }
        }

        if (! $request->boolean('include_archived')) {
            if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
                $q->whereNull('archived_at');
            }
            $q->where('status', '!=', 'Archived');
        }

        if ($request->filled('pub_status')) {
            $ps = strtolower(trim((string) $request->query('pub_status')));
            if (in_array($ps, ['pending', 'approved', 'rejected'], true)) {
                $q->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", [$ps]);
            }
        }

        $aud = strtolower(trim((string) $request->query('audience', '')));
        if ($aud === 'borrower') {
            $q->whereNotNull('borrower_id');
        } elseif ($aud === 'customer') {
            $q->whereNull('borrower_id');
        }

        if ($request->boolean('featured_only')) {
            $q->where('featured', true);
        }

        if ($request->filled('rating_min')) {
            $q->where('rating', '>=', (int) $request->query('rating_min'));
        }
        if ($request->filled('rating_max')) {
            $q->where('rating', '<=', (int) $request->query('rating_max'));
        }

        if ($request->filled('date_from')) {
            $q->where('created_at', '>=', $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $q->where('created_at', '<=', $request->query('date_to'));
        }

        // Quick tabs compatibility (All/New/Read/Replied/High Rating/Low Rating).
        $quick = strtolower((string) $request->query('quick', ''));
        if ($quick === 'high_rating') {
            $q->where('rating', '>=', 4);
        } elseif ($quick === 'low_rating') {
            $q->where('rating', '<=', 2);
        } elseif (in_array($quick, ['new', 'read', 'replied'], true)) {
            $q->where('status', ucfirst($quick));
        }

        $perPage = min(max((int) $request->query('per_page', 25), 5), 100);
        $paginator = $q->orderByDesc('id')->paginate($perPage);
        $payload = $paginator->toArray();
        $payload['featured_slots'] = [
            'used' => $this->countApprovedFeaturedTickets(),
            'max' => 3,
        ];

        return response()->json(['ok' => true, 'data' => $payload]);
    }

    /**
     * Approved + featured testimonials shown on the public homepage (max 3).
     */
    private function countApprovedFeaturedTickets(?int $exceptId = null): int
    {
        $q = FeedbackTicket::query()
            ->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", ['approved'])
            ->where('featured', true);
        if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
            $q->whereNull('archived_at');
        }
        $q->where('status', '!=', 'Archived');
        if ($exceptId !== null) {
            $q->where('id', '!=', $exceptId);
        }

        return (int) $q->count();
    }

    private function assertFeaturedSlotAvailable(FeedbackTicket $ticket): ?JsonResponse
    {
        if (! $ticket->featured && $this->countApprovedFeaturedTickets($ticket->id) >= 3) {
            return response()->json([
                'ok' => false,
                'message' => 'Maximum of 3 featured testimonials are allowed. Unfeature another approved item first.',
            ], 422);
        }

        return null;
    }

    public function show(FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request = request(), $ticket);

        return response()->json(['ok' => true, 'data' => $this->presentTicket($ticket)]);
    }

    public function updateStatus(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $allowed = [
            'New', 'Read', 'Replied', 'Pending', 'In Progress', 'Escalated', 'Resolved', 'Closed', 'Archived',
        ];

        $data = $request->validate([
            'status' => ['required', 'string', Rule::in($allowed)],
        ]);

        $ticket->status = $data['status'];
        if ($data['status'] === 'Resolved') {
            $ticket->resolved_at = now();
        }
        if (in_array($data['status'], ['Closed', 'Archived'], true)) {
            $ticket->closed_at = now();
        }
        if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
            if ($data['status'] === 'Archived') {
                $ticket->archived_at = $ticket->archived_at ?: now();
            } else {
                $ticket->archived_at = null;
            }
        }
        $ticket->save();

        // Keep legacy support_chat_feedback consistent when ticket came from it.
        if ($ticket->support_chat_feedback_id && DB::getSchemaBuilder()->hasTable('support_chat_feedback')) {
            $legacy = DB::table('support_chat_feedback')->where('id', $ticket->support_chat_feedback_id)->first();
            if ($legacy) {
                $legacyStatus = $this->mapToLegacyStatus($data['status']);
                DB::table('support_chat_feedback')
                    ->where('id', $ticket->support_chat_feedback_id)
                    ->update([
                        'status' => $legacyStatus,
                        'read_at' => $legacyStatus === 'new' ? null : ($legacy->read_at ?: now()),
                        'replied_at' => $legacyStatus === 'replied' ? now() : null,
                        'updated_at' => now(),
                    ]);
            }
        }

        $this->audit($request, $ticket, 'status.update', ['status' => $data['status']]);

        $this->upsertAnalytics($ticket);

        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($ticket->fresh())]);
    }

    public function updateTicket(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $data = $request->validate([
            'department' => 'nullable|string|max:64',
            'is_sensitive' => 'nullable|boolean',
            'is_vip' => 'nullable|boolean',
            'website_visible' => 'nullable|boolean',
            'full_name' => 'nullable|string|max:191',
            'public_author_label' => 'nullable|string|max:120',
            'publication_status' => 'nullable|string|in:pending,approved,rejected',
            'featured' => 'nullable|boolean',
            'source' => 'nullable|string|max:32',
            'consent_public_display' => 'nullable|boolean',
            'verified_borrower' => 'nullable|boolean',
            'loan_type' => 'nullable|string|max:96',
            'message' => 'nullable|string|max:8000',
            'admin_notes' => 'nullable|string|max:8000',
            'tags' => 'nullable|array',
            'checklist' => 'nullable|array',
        ]);

        if (array_key_exists('message', $data) && $data['message'] !== null) {
            $clean = SupportChatPresenter::sanitizeBody((string) $data['message']);
            if ($clean === '') {
                return response()->json(['ok' => false, 'message' => 'Message cannot be empty.'], 422);
            }
            $data['message'] = $clean;
        }

        $wasFeatured = (bool) $ticket->featured;
        if (array_key_exists('featured', $data) && $data['featured'] && ! $wasFeatured) {
            $limitResp = $this->assertFeaturedSlotAvailable($ticket);
            if ($limitResp instanceof JsonResponse) {
                return $limitResp;
            }
        }

        $before = $ticket->only(array_keys($data));
        foreach ($data as $k => $v) {
            $ticket->{$k} = $v;
        }

        $ticket->save();

        $this->audit($request, $ticket, 'ticket.update', ['before' => $before, 'after' => $ticket->only(array_keys($data))]);

        $invalidateKeys = [
            'website_visible', 'public_author_label', 'publication_status', 'featured',
            'consent_public_display', 'verified_borrower', 'loan_type', 'message', 'rating',
        ];
        $invalidatePublic = false;
        foreach ($invalidateKeys as $k) {
            if (array_key_exists($k, $data)) {
                $invalidatePublic = true;
                break;
            }
        }
        if ($invalidatePublic) {
            PublicWebsiteTestimonialsController::forgetCaches();
        }

        return response()->json(['ok' => true, 'data' => $this->presentTicket($ticket->fresh([
            'borrower.borrowerProfile',
            'borrower.loans',
            'borrower.loanApplications.loanProduct',
            'assignedStaff',
            'analytics',
        ]))]);
    }

    public function analytics(FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request = request(), $ticket);

        $ticket->loadMissing('analytics');

        return response()->json(['ok' => true, 'data' => $ticket->analytics]);
    }

    public function destroy(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $ticketId = $ticket->id;

        $this->audit($request, $ticket, 'ticket.delete', ['ticket_id' => $ticketId]);
        $ticket->delete();

        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true]);
    }

    public function approveForWebsite(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $data = $request->validate([
            'consent_public_display' => 'sometimes|boolean',
            'featured' => 'sometimes|boolean',
        ]);

        if (($data['featured'] ?? false) === true) {
            $limitResp = $this->assertFeaturedSlotAvailable($ticket);
            if ($limitResp instanceof JsonResponse) {
                return $limitResp;
            }
        }

        $ticket->publication_status = 'approved';
        $ticket->website_visible = true;
        $ticket->publication_approved_at = now();
        $ticket->rejected_at = null;
        if (array_key_exists('consent_public_display', $data)) {
            $ticket->consent_public_display = (bool) $data['consent_public_display'];
        }
        if (array_key_exists('featured', $data)) {
            $ticket->featured = (bool) $data['featured'];
        }
        $ticket->save();

        $this->audit($request, $ticket, 'publication.approve', $data);
        PublicWebsiteTestimonialsController::forgetCaches();

        $ticketId = (int) $ticket->id;
        dispatch(function () use ($ticketId): void {
            try {
                $t = FeedbackTicket::query()->with(['borrower:id,name,email'])->find($ticketId);
                if (! $t || ($t->publication_status ?? '') !== 'approved' || ! ($t->consent_public_display ?? false)) {
                    return;
                }
                $to = trim((string) ($t->email ?: $t->borrower?->email ?? ''));
                if ($to === '' || ! filter_var($to, FILTER_VALIDATE_EMAIL)) {
                    return;
                }
                $name = trim((string) ($t->full_name ?: $t->borrower?->name ?: $to));
                $display = trim((string) ($t->public_author_label ?? ''));
                if ($display === '') {
                    $display = Str::limit($name, 80, '');
                }
                $body = 'Your review has been approved for public display on our website (where you gave consent). Thank you for sharing your experience'.($display !== '' ? ' — we may show you as “'.$display.'”.' : '.');
                $mailable = new FeedbackTestimonialApprovedMail($name !== '' ? $name : 'Borrower', $body);
                $subject = 'Thank you — testimonial approved — '.config('app.name', 'Amalgated Lending Inc.');
                app(TransactionalMailSender::class)->sendHtmlMailable($mailable, $to, $name !== '' ? $name : $to, $subject, [
                    'flow' => 'feedback_testimonial_approved',
                    'feedback_ticket_id' => $t->id,
                ], []);
            } catch (\Throwable $e) {
                report($e);
            }
        })->afterResponse();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($this->freshTicketForPresentation($ticket))]);
    }

    public function rejectForWebsite(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $ticket->publication_status = 'rejected';
        $ticket->website_visible = false;
        $ticket->featured = false;
        $ticket->rejected_at = now();
        $ticket->publication_approved_at = null;
        $ticket->save();

        $this->audit($request, $ticket, 'publication.reject', []);
        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($this->freshTicketForPresentation($ticket))]);
    }

    public function featureForWebsite(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        abort_unless($ticket->publication_status === 'approved', 422, 'Approve the testimonial before featuring.');

        if (! $ticket->featured) {
            $limitResp = $this->assertFeaturedSlotAvailable($ticket);
            if ($limitResp instanceof JsonResponse) {
                return $limitResp;
            }
        }

        $ticket->featured = true;
        $ticket->save();
        $this->audit($request, $ticket, 'publication.feature', []);
        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($this->freshTicketForPresentation($ticket))]);
    }

    public function unfeatureForWebsite(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $ticket->featured = false;
        $ticket->save();
        $this->audit($request, $ticket, 'publication.unfeature', []);
        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($this->freshTicketForPresentation($ticket))]);
    }

    public function verifyBorrower(Request $request, FeedbackTicket $ticket): JsonResponse
    {
        $this->ensureTicketsAvailable();
        $this->authorizeSensitive($request, $ticket);

        $ticket->verified_borrower = true;
        $ticket->save();
        $this->audit($request, $ticket, 'borrower.verified', []);
        PublicWebsiteTestimonialsController::forgetCaches();

        return response()->json(['ok' => true, 'data' => $this->presentTicket($this->freshTicketForPresentation($ticket))]);
    }

    private function freshTicketForPresentation(FeedbackTicket $ticket): FeedbackTicket
    {
        return $ticket->fresh([
            'borrower.borrowerProfile',
            'borrower.loans',
            'borrower.loanApplications.loanProduct',
            'assignedStaff',
            'analytics',
        ]);
    }

    public function reportingSummary(Request $request): JsonResponse
    {
        $this->ensureTicketsAvailable();

        $from = $request->query('date_from');
        $to = $request->query('date_to');

        $base = FeedbackTicket::query()
            ->when($from, fn ($q) => $q->where('created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('created_at', '<=', $to));

        $total = (clone $base)->count();
        $byStatus = (clone $base)->select('status', DB::raw('count(*) as c'))->groupBy('status')->orderByDesc('c')->get();
        $byCategory = (clone $base)->select('category', DB::raw('count(*) as c'))->groupBy('category')->orderByDesc('c')->limit(12)->get();
        $byPriority = (clone $base)->select('priority', DB::raw('count(*) as c'))->groupBy('priority')->orderByDesc('c')->get();

        $avgFirstResponse = FeedbackAnalytics::query()
            ->join('feedback_tickets as t', 't.id', '=', 'feedback_analytics.feedback_id')
            ->when($from, fn ($q) => $q->where('t.created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('t.created_at', '<=', $to))
            ->whereNotNull('feedback_analytics.first_response_time')
            ->avg('feedback_analytics.first_response_time');

        $avgResolution = FeedbackAnalytics::query()
            ->join('feedback_tickets as t', 't.id', '=', 'feedback_analytics.feedback_id')
            ->when($from, fn ($q) => $q->where('t.created_at', '>=', $from))
            ->when($to, fn ($q) => $q->where('t.created_at', '<=', $to))
            ->whereNotNull('feedback_analytics.resolution_time')
            ->avg('feedback_analytics.resolution_time');

        return response()->json([
            'ok' => true,
            'data' => [
                'total' => $total,
                'by_status' => $byStatus,
                'by_category' => $byCategory,
                'by_priority' => $byPriority,
                'avg_first_response_minutes' => $avgFirstResponse !== null ? round((float) $avgFirstResponse, 1) : null,
                'avg_resolution_minutes' => $avgResolution !== null ? round((float) $avgResolution, 1) : null,
            ],
        ]);
    }

    private function legacyIndex(Request $request): JsonResponse
    {
        $status = strtolower((string) $request->query('status', 'all'));
        $allowed = ['all', 'new', 'read', 'replied'];
        if (! in_array($status, $allowed, true)) {
            $status = 'all';
        }

        $rows = SupportChatFeedback::query()
            ->select([
                'id',
                'session_id',
                'rating',
                'name',
                'email',
                'subject',
                'comment',
                'status',
                'read_at',
                'replied_at',
                'created_at',
            ])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest()
            ->limit(500)
            ->get();

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    private function ensureTicketsAvailable(): void
    {
        abort_unless(DB::getSchemaBuilder()->hasTable('feedback_tickets'), 409, 'Feedback ticketing is not yet migrated.');
    }

    private function audit(Request $request, FeedbackTicket $ticket, string $action, array $meta = []): void
    {
        if (! DB::getSchemaBuilder()->hasTable('feedback_audit_logs')) {
            return;
        }

        FeedbackAuditLog::create([
            'feedback_id' => $ticket->id,
            'actor_id' => $request->user()?->id,
            'action' => $action,
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }

    private function presentTicket(FeedbackTicket $ticket): array
    {
        $ticket->loadMissing([
            'borrower.borrowerProfile',
            'borrower.loans',
            'borrower.loanApplications.loanProduct',
            'assignedStaff',
            'analytics',
        ]);

        $borrower = $ticket->borrower;
        $profile = $borrower?->borrowerProfile;
        $loans = $borrower?->loans ?? collect();
        $applications = $borrower?->loanApplications ?? collect();

        $totalLoans = (int) $loans->count();
        $outstanding = (string) ($loans->sum(fn ($l) => (float) ($l->outstanding_balance ?? 0)));
        $paymentStatus = $ticket->payment_status;
        if (! $paymentStatus && $totalLoans > 0) {
            $hasOutstanding = $loans->contains(fn ($l) => (float) ($l->outstanding_balance ?? 0) > 0.01);
            $paymentStatus = $hasOutstanding ? 'Outstanding' : 'Cleared';
        }

        $latestApp = $applications->sortByDesc('id')->first();

        $publicSiteLive = FeedbackTicket::query()
            ->whereKey($ticket->id)
            ->forPublicWebsiteHomepage()
            ->exists();

        return [
            'id' => $ticket->id,
            'priority' => $ticket->priority,
            'status' => $ticket->status,
            'department' => $ticket->department,
            'tags' => $ticket->tags ?? [],
            'checklist' => $ticket->checklist ?? [],
            'is_sensitive' => (bool) $ticket->is_sensitive,
            'is_vip' => (bool) $ticket->is_vip,
            'website_visible' => (bool) ($ticket->website_visible ?? false),
            'public_author_label' => $ticket->public_author_label,
            'publication_status' => $ticket->publication_status ?? 'pending',
            'publication_approved_at' => optional($ticket->publication_approved_at)?->toIso8601String(),
            'rejected_at' => optional($ticket->rejected_at)?->toIso8601String(),
            'archived_at' => optional($ticket->archived_at)?->toIso8601String(),
            'customer_type_label' => $ticket->borrower_id ? 'Borrower' : 'Customer',
            'public_site_live' => $publicSiteLive,
            'featured' => (bool) ($ticket->featured ?? false),
            'source' => $ticket->source,
            'consent_public_display' => (bool) ($ticket->consent_public_display ?? false),
            'verified_borrower' => (bool) ($ticket->verified_borrower ?? false),
            'loan_type' => $ticket->loan_type,
            'admin_notes' => $ticket->admin_notes,
            'subject' => $ticket->subject,
            'message' => $ticket->message,
            'rating' => $ticket->rating,
            'sentiment_score' => $ticket->sentiment_score,
            'created_at' => optional($ticket->created_at)?->toIso8601String(),
            'updated_at' => optional($ticket->updated_at)?->toIso8601String(),
            'first_response_at' => optional($ticket->first_response_at)?->toIso8601String(),
            'resolved_at' => optional($ticket->resolved_at)?->toIso8601String(),
            'closed_at' => optional($ticket->closed_at)?->toIso8601String(),
            'follow_up_at' => optional($ticket->follow_up_at)?->toIso8601String(),
            'resolution_deadline_at' => optional($ticket->resolution_deadline_at)?->toIso8601String(),
            'escalation_count' => $ticket->escalation_count,
            'full_name' => $ticket->full_name,
            'contact' => [
                'full_name' => $ticket->full_name
                    ?: ($borrower ? ($borrower->name ?? null) : (($profile?->first_name || $profile?->last_name) ? trim(($profile?->first_name ?? '').' '.($profile?->last_name ?? '')) : null)),
                'borrower_id' => $borrower?->id,
                'contact_number' => $ticket->contact_number ?: ($profile?->phone_number ?: ($borrower?->phone ?? null)),
                'email' => $ticket->email ?: ($borrower?->email ?? null),
                'location' => $ticket->location ?: ($profile?->address ?? null),
                'customer_since' => optional($borrower?->created_at)?->toIso8601String(),
                'risk_level' => $ticket->risk_level ?: ($borrower?->risk_level ?? null),
                'vip_badge' => (bool) $ticket->is_vip,
            ],
            'loan_context' => [
                'loan_product_applied' => $latestApp?->loanProduct?->name ?? null,
                'loan_status' => $latestApp?->status ?? null,
                'application_reference_number' => $latestApp ? ('APP-'.str_pad((string) $latestApp->id, 6, '0', STR_PAD_LEFT)) : null,
                'total_loans_availed' => $totalLoans,
                'outstanding_balance' => $outstanding,
                'payment_status' => $paymentStatus,
            ],
            'assigned_staff' => $ticket->assignedStaff ? [
                'id' => $ticket->assignedStaff->id,
                'name' => $ticket->assignedStaff->name,
                'email' => $ticket->assignedStaff->email,
                'role' => $ticket->assignedStaff->role,
            ] : null,
            'analytics' => $ticket->analytics ? [
                'resolution_time' => $ticket->analytics->resolution_time,
                'csat_score' => $ticket->analytics->csat_score,
                'nps_score' => $ticket->analytics->nps_score,
                'escalation_count' => $ticket->analytics->escalation_count,
                'first_response_time' => $ticket->analytics->first_response_time,
            ] : null,
        ];
    }

    private function mapLegacyStatus(string $legacy): string
    {
        $v = strtolower(trim($legacy));

        return match ($v) {
            'new' => 'New',
            'read' => 'Read',
            'replied' => 'Replied',
            default => 'New',
        };
    }

    private function mapToLegacyStatus(string $status): string
    {
        $v = strtolower(trim($status));
        if ($v === 'read') {
            return 'read';
        }
        if ($v === 'replied') {
            return 'replied';
        }
        if (in_array($v, ['pending', 'in progress', 'escalated', 'resolved', 'closed', 'archived'], true)) {
            return 'read';
        }

        return 'new';
    }

    private function upsertAnalytics(FeedbackTicket $ticket): void
    {
        if (! DB::getSchemaBuilder()->hasTable('feedback_analytics')) {
            return;
        }

        $ticket->refresh();

        $firstResponseTime = null;
        if ($ticket->first_response_at && $ticket->created_at) {
            $firstResponseTime = max($ticket->created_at->diffInMinutes($ticket->first_response_at, false), 0);
        }

        $resolutionTime = null;
        if ($ticket->resolved_at && $ticket->created_at) {
            $resolutionTime = max($ticket->created_at->diffInMinutes($ticket->resolved_at, false), 0);
        }

        FeedbackAnalytics::query()->updateOrCreate(
            ['feedback_id' => $ticket->id],
            [
                'escalation_count' => (int) ($ticket->escalation_count ?? 0),
                'first_response_time' => $firstResponseTime,
                'resolution_time' => $resolutionTime,
            ],
        );
    }

    private function authorizeSensitive(Request $request, FeedbackTicket $ticket): void
    {
        if (! $ticket->is_sensitive) {
            return;
        }

        $u = $request->user();
        abort_unless($u, 401);

        $primary = strtolower((string) ($u->role ?? ''));
        if (in_array($primary, ['admin'], true)) {
            return;
        }
        $u->loadMissing('roles');
        $slugs = $u->roles->pluck('slug')->map(fn ($s) => strtolower((string) $s))->all();
        if (in_array('super-admin', $slugs, true)) {
            return;
        }

        abort(403, 'Sensitive feedback restricted.');
    }
}
