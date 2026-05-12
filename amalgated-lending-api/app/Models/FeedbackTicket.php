<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Schema;

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
                    ->orWhereRaw("TRIM(COALESCE(full_name, '')) <> ''")
                    ->orWhereHas('borrower', fn ($b) => $b->whereRaw("TRIM(COALESCE(name, '')) <> ''"))
                    ->orWhereRaw("TRIM(COALESCE(email, '')) <> ''");
            });
        }
    }
}
