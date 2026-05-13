<?php

/**
 * Corporate identity for print / PDF (SOA, invoices, loan forms).
 * Override via .env: COMPANY_PRINT_HEADER_NAME, COMPANY_SLOGAN, etc.
 */
return [
    'print_header_name' => env('COMPANY_PRINT_HEADER_NAME', 'AMALGAMATED LENDING INC.'),
    'slogan' => env('COMPANY_SLOGAN', 'Lending Hope, Building Futures.'),
    'address_lines' => [
        'ACI IT and Corporate Centre,',
        'Doña Carolina Uykimpan Building, Cor.',
        'JP Laurel Avenue and Iñigo Street,',
        'Bajada, Davao City 8000',
    ],
];
