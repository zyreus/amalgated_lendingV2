<?php

return [
    /*
    | Relative paths under storage/app — ensured at boot via PrintableFormPdfService.
    */
    'paths' => [
        'public_forms' => 'forms',
        'master_templates' => '../private/master_templates',
        'generated_pdfs' => 'generated_pdfs',
    ],
];
