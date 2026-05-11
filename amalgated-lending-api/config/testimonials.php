<?php

return [

    /** Minimum star rating (1–5) for homepage carousel. */
    'min_rating' => max(1, min(5, (int) env('TESTIMONIALS_MIN_RATING', 4))),

    /**
     * When true, only include rows that can show a real name: public display label,
     * ticket full_name (e.g. chatbot), or linked borrower name. Anonymous-only rows stay out.
     */
    'require_named_display' => filter_var(env('TESTIMONIALS_REQUIRE_NAMED_DISPLAY', true), FILTER_VALIDATE_BOOL),

];
