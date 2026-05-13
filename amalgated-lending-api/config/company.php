<?php

/**
 * Print / PDF letterhead (forms, SOA, invoices). Override via .env in production.
 */
return [
    'print_header_name' => env('COMPANY_PRINT_HEADER_NAME', env('APP_NAME', 'Amalgated Lending Inc.')),

    /** Bold caps line under logo (letterhead). */
    'print_legal_name' => env('COMPANY_PRINT_LEGAL_NAME', 'AMALGATED LENDING INC.'),

    /** Italic serif tagline; Blade/JS wrap with curly quotes for display. */
    'print_tagline' => env('COMPANY_PRINT_TAGLINE', 'Lending Hope, Building Futures.'),

    /** Right-aligned address block (one string per line). */
    'print_address_lines' => array_values(array_filter(array_map(
        'trim',
        preg_split(
            '/\r\n|\r|\n/',
            (string) env('COMPANY_PRINT_ADDRESS', implode("\n", [
                'ACI IT and Corporate Centre,',
                'Doña Carolina Uy Kim Peng Building, Cor.',
                'JP Laurel Avenue and Inigo Street,',
                'Bajada, Davao City 8000',
            ]))
        )
    ))),
];
