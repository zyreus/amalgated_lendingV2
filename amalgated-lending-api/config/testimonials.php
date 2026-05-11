<?php

return [

    /** Minimum star rating (1–5) for homepage carousel. */
    'min_rating' => max(1, min(5, (int) env('TESTIMONIALS_MIN_RATING', 4))),

    /**
     * When true, carousel only includes rows with a non-empty public display label
     * or a linked borrower account that has a name (avoids anonymous “Verified borrower” only).
     */
    'require_named_display' => filter_var(env('TESTIMONIALS_REQUIRE_NAMED_DISPLAY', true), FILTER_VALIDATE_BOOL),

];
