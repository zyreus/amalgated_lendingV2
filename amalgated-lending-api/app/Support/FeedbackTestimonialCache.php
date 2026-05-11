<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * File/database cache invalidation for public testimonial endpoints (no Redis).
 */
final class FeedbackTestimonialCache
{
    private const LEGACY_PREFIX = 'public_feedback_testimonials_v1_';

    private const WEBSITE_PREFIX = 'public_website_testimonials_v1_';

    public static function forgetAll(): void
    {
        for ($i = 1; $i <= 24; $i++) {
            Cache::forget(self::LEGACY_PREFIX.$i);
            Cache::forget(self::WEBSITE_PREFIX.$i);
        }
    }
}
