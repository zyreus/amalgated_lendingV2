<?php

namespace App\Support;

use Illuminate\Support\Facades\Cache;

/**
 * File/database cache invalidation for public testimonial endpoints (no Redis).
 */
final class FeedbackTestimonialCache
{
    public static function forgetAll(): void
    {
        for ($i = 1; $i <= 24; $i++) {
            foreach (
                [
                    'public_feedback_testimonials_v2_'.$i,
                    'public_website_testimonials_v2_'.$i,
                    'public_feedback_testimonials_v3_'.$i,
                    'public_website_testimonials_v3_'.$i,
                    'public_feedback_testimonials_v4_'.$i,
                    'public_website_testimonials_v4_'.$i,
                ] as $key
            ) {
                Cache::forget($key);
            }
        }
    }
}
