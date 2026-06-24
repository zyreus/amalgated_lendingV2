<?php

/**
 * Universal co-maker module configuration — shared across all loan products.
 */
return [
    'relationship_options' => [
        'Spouse', 'Parent', 'Child', 'Sibling', 'Relative', 'Friend',
        'Business Partner', 'Co-Employee', 'Guarantor', 'Other',
    ],

    'employment_status_options' => [
        'Employed', 'Self-Employed', 'Business Owner', 'Pensioner', 'OFW', 'Unemployed', 'Other',
    ],

    'gender_options' => ['Female', 'Male', 'Prefer not to say'],

    'civil_status_options' => ['Single', 'Married', 'Widowed', 'Separated', 'Annulled'],

    'valid_id_types' => [
        'PhilSys ID', 'UMID', "Driver's License", 'Passport', 'PRC ID',
        "Voter's ID", 'Senior Citizen ID', 'Postal ID', 'Other',
    ],

    'verification_statuses' => [
        'pending' => 'Pending review',
        'approved' => 'Approved',
        'rejected' => 'Rejected',
        'requires_resubmission' => 'Requires resubmission',
    ],

    'document_categories' => [
        'valid_id' => ['label' => 'Valid ID', 'required' => true, 'multiple' => true],
        'selfie_with_valid_id' => ['label' => 'Selfie with Valid ID', 'required' => true, 'multiple' => true],
        'proof_of_income' => ['label' => 'Proof of Income', 'required' => true, 'multiple' => true],
        'proof_of_billing' => ['label' => 'Proof of Billing', 'required' => true, 'multiple' => true],
        'signature_specimen' => ['label' => 'Signature Specimen', 'required' => true, 'multiple' => true],
        'supporting_documents' => ['label' => 'Supporting Documents', 'required' => false, 'multiple' => true],
    ],

    'max_upload_mb' => 20,
    'allowed_mimes' => ['jpg', 'jpeg', 'png', 'pdf'],
];
