<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FeedbackTicket;
use App\Models\User;
use App\Support\FeedbackTestimonialCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class PublicWebsiteTestimonialsController extends Controller
{
    private const CACHE_TTL_SECONDS = 300;

    /**
     * Homepage / marketing: approved + consent + min rating (+ optional display name rules).
     * Featured rows sort first; “Feature” in admin is optional prominence, not required to appear.
     */
    public function website(Request $request): JsonResponse
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return $this->emptyResponse();
        }

        $limit = min(max((int) $request->query('limit', 12), 1), 24);

        $payload = Cache::remember(
            'public_website_testimonials_v3_'.$limit,
            self::CACHE_TTL_SECONDS,
            fn () => $this->buildPayload($limit, false),
        );

        return response()
            ->json($payload)
            ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    }

    /**
     * Backward-compatible slim list for older SPA paths.
     */
    public function legacyList(Request $request): JsonResponse
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return response()
                ->json(['ok' => true, 'data' => []])
                ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0')
                ->header('Pragma', 'no-cache');
        }

        $limit = min(max((int) $request->query('limit', 12), 1), 24);

        $data = Cache::remember(
            'public_feedback_testimonials_v3_'.$limit,
            self::CACHE_TTL_SECONDS,
            function () use ($limit) {
                $full = $this->buildPayload($limit, false);

                return collect($full['data'] ?? [])->map(static function (array $row) {
                    return [
                        'id' => $row['id'],
                        'rating' => $row['rating'],
                        'quote' => $row['message'],
                        'author' => $row['display_name'],
                        'date' => $row['submitted_at'],
                    ];
                })->values()->all();
            },
        );

        return response()
            ->json(['ok' => true, 'data' => $data])
            ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    }

    public static function forgetCaches(): void
    {
        FeedbackTestimonialCache::forgetAll();
    }

    private function emptyResponse(): JsonResponse
    {
        return response()
            ->json([
                'ok' => true,
                'meta' => ['review_count' => 0, 'rating_value' => null],
                'data' => [],
            ])
            ->header('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    }

    /**
     * @param  bool  $requireFeatured  When true, only rows with featured=true (narrow listings).
     * @return array{ok: true, meta: array{review_count: int, rating_value: float|null}, data: array<int, array<string, mixed>>}
     */
    private function buildPayload(int $limit, bool $requireFeatured): array
    {
        $minRating = max(1, min(5, (int) config('testimonials.min_rating', 4)));
        $requireNamedDisplay = (bool) config('testimonials.require_named_display', true);

        $q = FeedbackTicket::query()
            ->select([
                'id',
                'borrower_id',
                'full_name',
                'public_author_label',
                'loan_type',
                'rating',
                'message',
                'verified_borrower',
                'featured',
                'source',
                'created_at',
                'updated_at',
            ])
            ->with(['borrower:id,name'])
            ->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", ['approved'])
            ->where('consent_public_display', true)
            ->whereNotNull('rating')
            ->where('rating', '>=', $minRating)
            ->whereNotNull('message')
            ->where('message', '!=', '');

        if ($requireNamedDisplay) {
            $q->where(function ($w) {
                $w->whereRaw("TRIM(COALESCE(public_author_label, '')) <> ''")
                    ->orWhereRaw("TRIM(COALESCE(full_name, '')) <> ''")
                    ->orWhereHas('borrower', fn ($b) => $b->whereRaw("TRIM(COALESCE(name, '')) <> ''"));
            });
        }

        if ($requireFeatured) {
            $q->where('featured', true);
        }

        $reviewCount = (clone $q)->count();
        $ratingValueAll = (clone $q)->avg('rating');

        $rows = $q
            ->orderByDesc('featured')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $items = $rows->map(function (FeedbackTicket $t) {
            $msg = Str::limit(trim(strip_tags((string) $t->message)), 320, '…');
            $verified = (bool) $t->verified_borrower;

            return [
                'id' => $t->id,
                'display_name' => $this->displayName($t->borrower, $t->public_author_label, $t->full_name),
                'loan_type' => $t->loan_type ?: 'Borrower',
                'rating' => (int) $t->rating,
                'message' => $msg,
                'verified_borrower' => $verified,
                'verified' => $verified,
                'source' => $t->source ?: 'chatbot',
                'submitted_at' => optional($t->created_at)?->toIso8601String(),
                'updated_at' => optional($t->updated_at)?->toIso8601String(),
            ];
        })->values()->all();

        return [
            'ok' => true,
            'meta' => [
                'review_count' => $reviewCount,
                'rating_value' => $ratingValueAll !== null ? round((float) $ratingValueAll, 2) : null,
            ],
            'data' => $items,
        ];
    }

    private function displayName(?User $borrower, ?string $publicLabel, ?string $ticketFullName = null): string
    {
        $label = trim((string) $publicLabel);
        if ($label !== '') {
            return $label;
        }
        $name = trim((string) ($borrower?->name ?? ''));
        if ($name === '') {
            $name = trim((string) ($ticketFullName ?? ''));
        }
        if ($name === '') {
            return 'Verified borrower';
        }
        $parts = preg_split('/\s+/u', $name, -1, PREG_SPLIT_NO_EMPTY);
        if (! $parts || count($parts) === 0) {
            return 'Verified borrower';
        }
        if (count($parts) === 1) {
            return $parts[0];
        }
        $last = array_pop($parts);
        $first = implode(' ', $parts);
        $ini = mb_strtoupper(mb_substr($last, 0, 1));

        return $first.' '.$ini.'.';
    }
}
