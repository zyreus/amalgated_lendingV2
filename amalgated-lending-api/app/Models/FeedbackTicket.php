<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class FeedbackTicket extends Model
{
    use SoftDeletes;

    protected $table = 'feedback_tickets';

    protected $fillable = [
        'borrower_id',
        'support_chat_feedback_id',
        'support_conversation_id',
        'category',
        'priority',
        'status',
        'assigned_staff_id',
        'department',
        'subject',
        'message',
        'rating',
        'sentiment_score',
        'contact_number',
        'email',
        'full_name',
        'location',
        'is_sensitive',
        'is_vip',
        'risk_level',
        'payment_status',
        'first_response_at',
        'resolved_at',
        'closed_at',
        'follow_up_at',
        'resolution_deadline_at',
        'sla_minutes',
        'escalation_count',
        'tags',
        'checklist',
        'website_visible',
        'public_author_label',
        'publication_status',
        'publication_approved_at',
        'rejected_at',
        'archived_at',
        'featured',
        'source',
        'consent_public_display',
        'verified_borrower',
        'loan_type',
        'admin_notes',
    ];

    protected $casts = [
        'rating' => 'integer',
        'sentiment_score' => 'decimal:2',
        'is_sensitive' => 'boolean',
        'is_vip' => 'boolean',
        'website_visible' => 'boolean',
        'featured' => 'boolean',
        'consent_public_display' => 'boolean',
        'verified_borrower' => 'boolean',
        'publication_approved_at' => 'datetime',
        'rejected_at' => 'datetime',
        'archived_at' => 'datetime',
        'first_response_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'follow_up_at' => 'datetime',
        'resolution_deadline_at' => 'datetime',
        'tags' => 'array',
        'checklist' => 'array',
    ];

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }

    public function assignedStaff(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_staff_id');
    }

    public function supportFeedback(): BelongsTo
    {
        return $this->belongsTo(SupportChatFeedback::class, 'support_chat_feedback_id');
    }

    public function supportConversation(): BelongsTo
    {
        return $this->belongsTo(SupportConversation::class, 'support_conversation_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(FeedbackReply::class, 'feedback_id')->orderBy('created_at')->orderBy('id');
    }

    public function analytics(): HasOne
    {
        return $this->hasOne(FeedbackAnalytics::class, 'feedback_id');
    }

    public function auditLogs(): HasMany
    {
        return $this->hasMany(FeedbackAuditLog::class, 'feedback_id')->latest('id');
    }

    /** Placeholder names that should not count as a public homepage display identity. */
    private const ANONYMOUS_PLACEHOLDER_NAMES = [
        'anonymous',
        'guest',
        'website visitor',
        'visitor',
        'n/a',
        'na',
        'unknown',
        'customer',
        'user',
    ];

    public static function isAnonymousPlaceholder(?string $value): bool
    {
        $normalized = strtolower(trim(preg_replace('/\s+/u', ' ', (string) $value)));

        if ($normalized === '') {
            return true;
        }

        return in_array($normalized, self::ANONYMOUS_PLACEHOLDER_NAMES, true);
    }

    public static function hasUsablePublicName(?string $value): bool
    {
        return trim((string) ($value ?? '')) !== '' && ! self::isAnonymousPlaceholder($value);
    }

    public static function normalizeFullName(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return self::hasUsablePublicName($trimmed) ? $trimmed : null;
    }

    /** Whether the ticket has no name/email the homepage can use without public_author_label. */
    public function lacksNamedDisplay(): bool
    {
        if (self::hasUsablePublicName($this->public_author_label)) {
            return false;
        }
        if (self::hasUsablePublicName($this->full_name)) {
            return false;
        }
        if (trim((string) ($this->email ?? '')) !== '') {
            return false;
        }
        $this->loadMissing('borrower:id,name,email');

        return ! self::hasUsablePublicName($this->borrower?->name);
    }

    /** Default label shown on the public homepage when no borrower name/email is available. */
    public function resolvePublicAuthorLabel(): string
    {
        $label = trim((string) ($this->public_author_label ?? ''));
        if ($label !== '') {
            return $label;
        }

        $fullName = trim((string) ($this->full_name ?? ''));
        if (self::hasUsablePublicName($fullName)) {
            return $fullName;
        }

        foreach ([$this->email, $this->borrower?->email ?? null] as $em) {
            $em = trim((string) ($em ?? ''));
            if ($em !== '' && str_contains($em, '@')) {
                return Str::before($em, '@');
            }
        }

        $this->loadMissing('borrower:id,name');
        $name = trim((string) ($this->borrower?->name ?? ''));
        if ($name !== '') {
            return $name;
        }

        return 'Verified Customer';
    }

    /** Set public_author_label when anonymous chatbot feedback would otherwise stay hidden. */
    public function ensurePublicAuthorLabelForHomepage(): bool
    {
        if (self::isAnonymousPlaceholder($this->full_name)) {
            $this->full_name = null;
        }

        if (! $this->lacksNamedDisplay()) {
            return false;
        }

        $this->public_author_label = $this->resolvePublicAuthorLabel();

        return true;
    }

    /**
     * Normalize identity fields before publishing to the public homepage.
     */
    public function prepareForPublicHomepage(): void
    {
        $this->loadMissing('borrower:id,name,email');
        $this->ensurePublicAuthorLabelForHomepage();
    }

    /**
     * @return list<string>
     */
    public function homepageVisibilityBlockers(): array
    {
        $blockers = [];
        $minRating = max(1, min(5, (int) config('testimonials.min_rating', 4)));

        if (strtolower(trim((string) ($this->publication_status ?? ''))) !== 'approved') {
            $blockers[] = 'Publication status is not approved.';
        }
        if (! ($this->consent_public_display ?? false)) {
            $blockers[] = 'Borrower consent for public display is off.';
        }
        if (! ($this->website_visible ?? false)) {
            $blockers[] = 'Website visibility flag is off.';
        }
        if ($this->rating === null) {
            $blockers[] = 'No star rating recorded on this ticket.';
        } elseif ((int) $this->rating < $minRating) {
            $blockers[] = 'Rating is '.((int) $this->rating).'/5 — homepage requires at least '.$minRating.' stars.';
        }
        if (trim((string) ($this->message ?? '')) === '') {
            $blockers[] = 'Feedback message is empty.';
        }
        if (Schema::hasColumn('feedback_tickets', 'archived_at') && $this->archived_at !== null) {
            $blockers[] = 'Ticket is archived.';
        }
        if ((bool) config('testimonials.require_named_display', true) && $this->lacksNamedDisplay()) {
            $blockers[] = 'Missing a public display name (required for anonymous chatbot feedback).';
        }

        return $blockers;
    }

    public function isPublicWebsiteLive(): bool
    {
        return static::query()->whereKey($this->id)->forPublicWebsiteHomepage()->exists();
    }

    /**
     * Rows eligible for the public homepage testimonials API (approval + consent + visibility;
     * verified_borrower is not part of this gate).
     */
    public function scopeForPublicWebsiteHomepage($query): void
    {
        $minRating = max(1, min(5, (int) config('testimonials.min_rating', 4)));
        $requireNamedDisplay = (bool) config('testimonials.require_named_display', true);

        $query
            ->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", ['approved'])
            ->where('consent_public_display', true)
            ->where('website_visible', true)
            ->whereNotNull('rating')
            ->where('rating', '>=', $minRating)
            ->whereNotNull('message')
            ->where('message', '!=', '');

        if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
            $query->whereNull('archived_at');
        }

        if ($requireNamedDisplay) {
            $query->where(function ($w) {
                $w->whereRaw("TRIM(COALESCE(public_author_label, '')) <> ''")
                    ->orWhereHas('borrower', fn ($b) => $b->whereRaw("TRIM(COALESCE(name, '')) <> ''"))
                    ->orWhereRaw("TRIM(COALESCE(email, '')) <> ''")
                    ->orWhere(function ($nameQuery) {
                        foreach (self::ANONYMOUS_PLACEHOLDER_NAMES as $placeholder) {
                            $nameQuery->whereRaw('LOWER(TRIM(COALESCE(full_name, ""))) <> ?', [$placeholder]);
                        }
                        $nameQuery->whereRaw("TRIM(COALESCE(full_name, '')) <> ''");
                    });
            });
        }
    }
}
