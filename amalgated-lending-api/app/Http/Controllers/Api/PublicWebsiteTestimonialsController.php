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
     * Homepage / marketing: approved + featured + consent + rating.
     */
    public function website(Request $request): JsonResponse
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return $this->emptyResponse();
        }

        $limit = min(max((int) $request->query('limit', 12), 1), 24);

        $payload = Cache::remember(
            'public_website_testimonials_v1_'.$limit,
            self::CACHE_TTL_SECONDS,
            fn () => $this->buildPayload($limit, true),
        );

        return response()
            ->json($payload)
            ->header('Cache-Control', 'public, max-age=120');
    }

    /**
     * Backward-compatible slim list for older SPA paths.
     */
    public function legacyList(Request $request): JsonResponse
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return response()
                ->json(['ok' => true, 'data' => []])
                ->header('Cache-Control', 'public, max-age=120');
        }

        $limit = min(max((int) $request->query('limit', 12), 1), 24);

        $data = Cache::remember(
            'public_feedback_testimonials_v1_'.$limit,
            self::CACHE_TTL_SECONDS,
            function () use ($limit) {
                $full = $this->buildPayload($limit, true);

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
            ->header('Cache-Control', 'public, max-age=120');
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
            ->header('Cache-Control', 'public, max-age=60');
    }

    /**
     * @return array{ok: true, meta: array{review_count: int, rating_value: float|null}, data: array<int, array<string, mixed>>}
     */
    private function buildPayload(int $limit, bool $requireFeatured): array
    {
        $q = FeedbackTicket::query()
            ->with(['borrower:id,name'])
            ->where('publication_status', 'approved')
            ->where('consent_public_display', true)
            ->whereNotNull('rating')
            ->where('rating', '>=', 4)
            ->whereNotNull('message')
            ->where('message', '!=', '');

        if ($requireFeatured) {
            $q->where('featured', true);
        }

        $rows = $q
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $avg = $rows->avg('rating');
        $items = $rows->map(function (FeedbackTicket $t) {
            $msg = Str::limit(trim(strip_tags((string) $t->message)), 320, '…');

            return [
                'id' => $t->id,
                'display_name' => $this->displayName($t->borrower, $t->public_author_label),
                'loan_type' => $t->loan_type ?: 'Borrower',
                'rating' => (int) $t->rating,
                'message' => $msg,
                'verified_borrower' => (bool) $t->verified_borrower,
                'source' => $t->source ?: 'chatbot',
                'submitted_at' => optional($t->created_at)?->toIso8601String(),
            ];
        })->values()->all();

        return [
            'ok' => true,
            'meta' => [
                'review_count' => count($items),
                'rating_value' => $avg !== null ? round((float) $avg, 2) : null,
            ],
            'data' => $items,
        ];
    }

    private function displayName(?User $borrower, ?string $publicLabel): string
    {
        $label = trim((string) $publicLabel);
        if ($label !== '') {
            return $label;
        }
        $name = trim((string) ($borrower?->name ?? ''));
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
