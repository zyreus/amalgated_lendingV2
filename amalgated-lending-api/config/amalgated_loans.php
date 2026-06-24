<?php

/**
 * General loan application: exactly one loan_type drives visible fields and documents.
 * Document paths live in loan_applications.documents JSON (keys below).
 */
return [
    'general_loan_types' => [
        'salary' => 'Salary Loan',
        'chattel' => 'Chattel Mortgage Loan',
        'real_estate' => 'Real Estate Mortgage Loan',
        'sss_pension' => 'SSS / GSIS Pension Loan',
        'travel_assistance' => 'Travel Assistance Loan',
    ],

    'loan_application_routes' => [
        'salary' => 'salary-loan',
        'chattel' => 'chattel-mortgage',
        'real_estate' => 'real-estate-mortgage',
        'sss_pension' => 'pension-loan',
        'travel_assistance' => 'travel-assistance',
    ],

    'product_application_steps' => [
        'salary' => [
            ['id' => 1, 'title' => 'Personal Information', 'section' => 'personal'],
            ['id' => 2, 'title' => 'Employment Information', 'section' => 'employment'],
            ['id' => 3, 'title' => 'Income Information', 'section' => 'income'],
            ['id' => 4, 'title' => 'Loan Details', 'section' => 'loan'],
            ['id' => 5, 'title' => 'Co-Maker Information', 'section' => 'co_makers'],
            ['id' => 6, 'title' => 'Required Documents', 'section' => 'documents'],
            ['id' => 7, 'title' => 'Review & Submit', 'section' => 'review'],
        ],
        'chattel' => [
            ['id' => 1, 'title' => 'Borrower Information', 'section' => 'borrower'],
            ['id' => 2, 'title' => 'Vehicle Information', 'section' => 'vehicle'],
            ['id' => 3, 'title' => 'Loan Information', 'section' => 'loan'],
            ['id' => 4, 'title' => 'Co-Maker Information', 'section' => 'co_makers'],
            ['id' => 5, 'title' => 'Document Upload', 'section' => 'documents'],
            ['id' => 6, 'title' => 'Review & Submit', 'section' => 'review'],
        ],
        'real_estate' => [
            ['id' => 1, 'title' => 'Borrower Information', 'section' => 'borrower'],
            ['id' => 2, 'title' => 'Property Information', 'section' => 'property'],
            ['id' => 3, 'title' => 'Loan Information', 'section' => 'loan'],
            ['id' => 4, 'title' => 'Property Documents', 'section' => 'documents'],
            ['id' => 5, 'title' => 'Review & Submit', 'section' => 'review'],
        ],
        'sss_pension' => [
            ['id' => 1, 'title' => 'Pensioner Information', 'section' => 'pensioner'],
            ['id' => 2, 'title' => 'Pension Information', 'section' => 'pension'],
            ['id' => 3, 'title' => 'Loan Information', 'section' => 'loan'],
            ['id' => 4, 'title' => 'Document Upload', 'section' => 'documents'],
            ['id' => 5, 'title' => 'Review & Submit', 'section' => 'review'],
        ],
        'travel_assistance' => [
            ['id' => 1, 'title' => 'Applicant Information', 'section' => 'applicant'],
            ['id' => 2, 'title' => 'Travel Information', 'section' => 'travel'],
            ['id' => 3, 'title' => 'Employment / Financial Information', 'section' => 'employment_financial'],
            ['id' => 4, 'title' => 'Loan Information', 'section' => 'loan'],
            ['id' => 5, 'title' => 'Required Documents', 'section' => 'documents'],
            ['id' => 6, 'title' => 'Review & Submit', 'section' => 'review'],
        ],
    ],

    'product_application_fields' => [
        'salary' => [
            'personal' => [
                ['key' => 'full_name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
                ['key' => 'birthdate', 'label' => 'Birthdate', 'type' => 'date', 'required' => true],
                ['key' => 'civil_status', 'label' => 'Civil Status', 'type' => 'select', 'required' => true, 'options' => ['Single', 'Married', 'Widowed', 'Separated']],
                ['key' => 'address', 'label' => 'Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'phone', 'label' => 'Contact Number', 'type' => 'text', 'required' => true],
            ],
            'employment' => [
                ['key' => 'employer_name', 'label' => 'Employer Name', 'type' => 'text', 'required' => true],
                ['key' => 'company_address', 'label' => 'Company Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'position', 'label' => 'Position', 'type' => 'text', 'required' => true],
                ['key' => 'employment_type', 'label' => 'Employment Type', 'type' => 'select', 'required' => true, 'options' => ['Regular', 'Probationary', 'Contractual', 'Project-based']],
                ['key' => 'years_of_service', 'label' => 'Years of Service', 'type' => 'numeric', 'required' => true],
            ],
            'income' => [
                ['key' => 'monthly_gross_salary', 'label' => 'Monthly Gross Salary', 'type' => 'numeric', 'required' => true],
                ['key' => 'monthly_net_salary', 'label' => 'Monthly Net Salary', 'type' => 'numeric', 'required' => true],
                ['key' => 'other_income', 'label' => 'Other Income', 'type' => 'numeric', 'required' => false],
            ],
            'loan' => [
                ['key' => 'loan_product_id', 'label' => 'Loan Product', 'type' => 'loan_product', 'required' => true],
                ['key' => 'term_months', 'label' => 'Loan Term', 'type' => 'numeric', 'required' => true],
                ['key' => 'loan_purpose', 'label' => 'Loan Purpose', 'type' => 'textarea', 'required' => true],
            ],
        ],
        'chattel' => [
            'borrower' => [
                ['key' => 'full_name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
                ['key' => 'birthdate', 'label' => 'Birthdate', 'type' => 'date', 'required' => true],
                ['key' => 'civil_status', 'label' => 'Civil Status', 'type' => 'select', 'required' => true, 'options' => ['Single', 'Married', 'Widowed', 'Separated']],
                ['key' => 'address', 'label' => 'Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'phone', 'label' => 'Contact Number', 'type' => 'text', 'required' => true],
            ],
            'vehicle' => [
                ['key' => 'vehicle_type', 'label' => 'Vehicle Type', 'type' => 'text', 'required' => true],
                ['key' => 'brand', 'label' => 'Brand', 'type' => 'text', 'required' => true],
                ['key' => 'model', 'label' => 'Model', 'type' => 'text', 'required' => true],
                ['key' => 'year_model', 'label' => 'Year Model', 'type' => 'numeric', 'required' => true],
                ['key' => 'plate_number', 'label' => 'Plate Number', 'type' => 'text', 'required' => true],
                ['key' => 'engine_number', 'label' => 'Engine Number', 'type' => 'text', 'required' => true],
                ['key' => 'chassis_number', 'label' => 'Chassis Number', 'type' => 'text', 'required' => true],
                ['key' => 'or_number', 'label' => 'OR Number', 'type' => 'text', 'required' => true],
                ['key' => 'cr_number', 'label' => 'CR Number', 'type' => 'text', 'required' => true],
                ['key' => 'market_value', 'label' => 'Market Value', 'type' => 'numeric', 'required' => true],
            ],
            'loan' => [
                ['key' => 'loan_product_id', 'label' => 'Loan Product', 'type' => 'loan_product', 'required' => true],
                ['key' => 'term_months', 'label' => 'Loan Term', 'type' => 'numeric', 'required' => true],
                ['key' => 'loan_purpose', 'label' => 'Loan Purpose', 'type' => 'textarea', 'required' => true],
            ],
        ],
        'real_estate' => [
            'borrower' => [
                ['key' => 'full_name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
                ['key' => 'birthdate', 'label' => 'Birthdate', 'type' => 'date', 'required' => true],
                ['key' => 'civil_status', 'label' => 'Civil Status', 'type' => 'select', 'required' => true, 'options' => ['Single', 'Married', 'Widowed', 'Separated']],
                ['key' => 'address', 'label' => 'Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'phone', 'label' => 'Contact Number', 'type' => 'text', 'required' => true],
            ],
            'property' => [
                ['key' => 'property_type', 'label' => 'Property Type', 'type' => 'select', 'required' => true, 'options' => ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Lot Only', 'Other']],
                ['key' => 'property_address', 'label' => 'Property Location / Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'property_description', 'label' => 'Brief Property Description', 'type' => 'textarea', 'required' => true],
                ['key' => 'title_number', 'label' => 'Title Number (if available)', 'type' => 'text', 'required' => false],
                ['key' => 'tax_declaration_number', 'label' => 'Tax Declaration Number (if available)', 'type' => 'text', 'required' => false],
            ],
            'loan' => [
                ['key' => 'loan_product_id', 'label' => 'Loan Product', 'type' => 'loan_product', 'required' => true],
                ['key' => 'term_months', 'label' => 'Loan Term', 'type' => 'numeric', 'required' => true],
                ['key' => 'loan_purpose', 'label' => 'Loan Purpose', 'type' => 'textarea', 'required' => true],
            ],
        ],
        'sss_pension' => [
            'pensioner' => [
                ['key' => 'full_name', 'label' => 'Full Name', 'type' => 'text', 'required' => true],
                ['key' => 'birthdate', 'label' => 'Birthdate', 'type' => 'date', 'required' => true],
                ['key' => 'civil_status', 'label' => 'Civil Status', 'type' => 'select', 'required' => true, 'options' => ['Single', 'Married', 'Widowed', 'Separated']],
                ['key' => 'address', 'label' => 'Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'phone', 'label' => 'Contact Number', 'type' => 'text', 'required' => true],
            ],
            'pension' => [
                ['key' => 'pension_type', 'label' => 'Pension Type', 'type' => 'select', 'required' => true, 'options' => ['SSS', 'GSIS']],
                ['key' => 'monthly_pension', 'label' => 'Monthly Pension (PHP)', 'type' => 'numeric', 'required' => true],
                ['key' => 'sss_number', 'label' => 'SSS Number', 'type' => 'text', 'required_if' => ['pension_type' => 'SSS']],
                ['key' => 'gsis_bp_number', 'label' => 'GSIS BP Number', 'type' => 'text', 'required_if' => ['pension_type' => 'GSIS']],
                ['key' => 'pension_start_date', 'label' => 'Pension Start Date', 'type' => 'date', 'required' => true],
                ['key' => 'bank_account_number', 'label' => 'Bank Account Number', 'type' => 'text', 'required' => true],
            ],
            'loan' => [
                ['key' => 'loan_product_id', 'label' => 'Loan Product', 'type' => 'loan_product', 'required' => true],
                ['key' => 'term_months', 'label' => 'Loan Term (months)', 'type' => 'numeric', 'required' => true],
                ['key' => 'application_nature', 'label' => 'Application Nature', 'type' => 'select', 'required' => true, 'options' => ['new', 'reloan']],
                ['key' => 'loan_purpose', 'label' => 'Loan Purpose', 'type' => 'textarea', 'required' => true],
            ],
        ],
        'travel_assistance' => [
            'applicant' => [
                ['key' => 'first_name', 'label' => 'First Name', 'type' => 'text', 'required' => true],
                ['key' => 'middle_name', 'label' => 'Middle Name', 'type' => 'text', 'required' => false],
                ['key' => 'last_name', 'label' => 'Last Name', 'type' => 'text', 'required' => true],
                ['key' => 'suffix', 'label' => 'Suffix', 'type' => 'text', 'required' => false],
                ['key' => 'birthdate', 'label' => 'Birthdate', 'type' => 'date', 'required' => true],
                ['key' => 'age', 'label' => 'Age', 'type' => 'numeric', 'required' => true],
                ['key' => 'gender', 'label' => 'Gender', 'type' => 'select', 'required' => true, 'options' => ['Female', 'Male', 'Prefer not to say']],
                ['key' => 'civil_status', 'label' => 'Civil Status', 'type' => 'select', 'required' => true, 'options' => ['Single', 'Married', 'Widowed', 'Separated']],
                ['key' => 'phone', 'label' => 'Contact Number', 'type' => 'text', 'required' => true],
                ['key' => 'email', 'label' => 'Email Address', 'type' => 'email', 'required' => true],
                ['key' => 'address', 'label' => 'Complete Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'emergency_contact_name', 'label' => 'Emergency Contact Full Name', 'type' => 'text', 'required' => true],
                ['key' => 'emergency_contact_relationship', 'label' => 'Emergency Contact Relationship', 'type' => 'text', 'required' => true],
                ['key' => 'emergency_contact_phone', 'label' => 'Emergency Contact Number', 'type' => 'text', 'required' => true],
                ['key' => 'emergency_contact_address', 'label' => 'Emergency Contact Address', 'type' => 'textarea', 'required' => true],
            ],
            'travel' => [
                ['key' => 'travel_purpose', 'label' => 'Travel Purpose', 'type' => 'select', 'required' => true, 'options' => ['OFW Deployment', 'Tourist Travel', 'Business Travel', 'Educational Travel', 'Medical Travel', 'Seafarer Deployment', 'Immigration Processing', 'Other']],
                ['key' => 'destination_country', 'label' => 'Destination Country', 'type' => 'text', 'required' => true],
                ['key' => 'destination_city', 'label' => 'Destination City', 'type' => 'text', 'required' => true],
                ['key' => 'departure_date', 'label' => 'Expected Departure Date', 'type' => 'date', 'required' => true],
                ['key' => 'return_date', 'label' => 'Expected Return Date', 'type' => 'date', 'required' => false],
                ['key' => 'travel_agency', 'label' => 'Travel Agency (Optional)', 'type' => 'text', 'required' => false],
                ['key' => 'agency_name', 'label' => 'Employer / Agency Name', 'type' => 'text', 'required' => false],
                ['key' => 'recruitment_agency', 'label' => 'Recruitment Agency', 'type' => 'text', 'required' => false],
                ['key' => 'visa_status', 'label' => 'Visa Status', 'type' => 'select', 'required' => true, 'options' => ['Processing', 'Approved', 'Not Yet Applied', 'Not Required']],
                ['key' => 'airfare_cost', 'label' => 'Airfare Cost', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'visa_cost', 'label' => 'Visa Cost', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'medical_cost', 'label' => 'Medical Cost', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'placement_fee', 'label' => 'Placement Fee', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'processing_fee', 'label' => 'Processing Fee', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'pocket_money_requirement', 'label' => 'Pocket Money Requirement', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'other_expenses', 'label' => 'Other Expenses', 'type' => 'numeric', 'required' => false, 'sum_group' => 'travel_cost'],
                ['key' => 'travel_cost', 'label' => 'Total Estimated Travel Cost', 'type' => 'computed_sum', 'required' => false],
            ],
            'employment_financial' => [
                ['key' => 'employment_status', 'label' => 'Employment Status', 'type' => 'select', 'required' => true, 'options' => ['Employed', 'OFW Applicant', 'Seafarer', 'Self-Employed', 'Freelancer', 'Business Owner']],
                ['key' => 'employer_name', 'label' => 'Employer Name', 'type' => 'text', 'required' => true],
                ['key' => 'company_address', 'label' => 'Company Address', 'type' => 'textarea', 'required' => true],
                ['key' => 'position', 'label' => 'Position', 'type' => 'text', 'required' => true],
                ['key' => 'monthly_income', 'label' => 'Monthly Income', 'type' => 'numeric', 'required' => true],
                ['key' => 'other_income_sources', 'label' => 'Other Sources of Income', 'type' => 'textarea', 'required' => false],
            ],
            'loan' => [
                ['key' => 'loan_product_id', 'label' => 'Loan Product', 'type' => 'loan_product', 'required' => true],
                ['key' => 'term_months', 'label' => 'Loan Term', 'type' => 'numeric', 'required' => true],
                ['key' => 'loan_purpose', 'label' => 'Purpose of Loan', 'type' => 'select', 'required' => true, 'options' => ['Airfare Assistance', 'Visa Processing', 'Placement Fee', 'Medical Examination', 'Travel Expenses', 'Educational Travel Expenses', 'Emergency Travel']],
                ['key' => 'repayment_frequency', 'label' => 'Repayment Frequency', 'type' => 'select', 'required' => true, 'options' => ['Weekly', 'Semi-Monthly', 'Monthly']],
            ],
        ],
    ],

    /*
    | Each loan_type => [ key => [ label, required, multiple ] ]
    | Keys must match FileUpload field names: documents.{key}
    */
    'loan_types_requiring_co_makers' => ['salary', 'chattel'],

    'co_maker_document_categories' => [
        'valid_id' => ['label' => 'Valid ID', 'required' => true, 'multiple' => true],
        'selfie_with_valid_id' => ['label' => 'Selfie with Valid ID', 'required' => true, 'multiple' => true],
        'proof_of_income' => ['label' => 'Proof of Income', 'required' => true, 'multiple' => true],
        'proof_of_billing' => ['label' => 'Proof of Billing', 'required' => true, 'multiple' => true],
        'signature_specimen' => ['label' => 'Signature Specimen', 'required' => true, 'multiple' => true],
        'supporting_documents' => ['label' => 'Supporting Documents', 'required' => false, 'multiple' => true],
    ],

    'general_documents' => [
        'salary' => [
            'company_id' => ['label' => 'Company ID', 'required' => true, 'multiple' => true],
            'payslip' => ['label' => 'Payslip', 'required' => true, 'multiple' => true],
            'coe' => ['label' => 'COE', 'required' => true, 'multiple' => true],
            'government_id_front' => ['label' => 'Valid ID — Front', 'required' => true, 'multiple' => true],
            'government_id_back' => ['label' => 'Valid ID — Back', 'required' => true, 'multiple' => true],
        ],
        'chattel' => [
            'or_cr' => ['label' => 'OR/CR', 'required' => true, 'multiple' => true],
            'vehicle_photos_front' => ['label' => 'Collateral Photos — Front View', 'required' => true, 'multiple' => true],
            'vehicle_photos_side' => ['label' => 'Collateral Photos — Side View', 'required' => true, 'multiple' => true],
            'vehicle_photos_interior' => ['label' => 'Collateral Photos — Interior', 'required' => false, 'multiple' => true],
            'vehicle_photos_additional' => ['label' => 'Collateral Photos — Additional', 'required' => false, 'multiple' => true],
            'insurance' => ['label' => 'Insurance', 'required' => true, 'multiple' => true],
            'government_id_front' => ['label' => 'Valid ID — Front', 'required' => true, 'multiple' => true],
            'government_id_back' => ['label' => 'Valid ID — Back', 'required' => true, 'multiple' => true],
            'proof_of_income' => ['label' => 'Proof of Income', 'required' => true, 'multiple' => true],
        ],
        'real_estate' => [
            'land_title' => ['label' => 'Land Title', 'required' => false, 'multiple' => true, 'group' => 'property_documents'],
            'tax_declaration' => ['label' => 'Tax Declaration', 'required' => false, 'multiple' => true, 'group' => 'property_documents'],
            'lot_plan' => ['label' => 'Sketch / Lot Plan', 'required' => false, 'multiple' => true, 'group' => 'property_documents'],
            'property_sketch' => ['label' => 'Supporting Documents', 'required' => false, 'multiple' => true, 'group' => 'property_documents'],
            'tax_clearance' => ['label' => 'Tax Clearance', 'required' => false, 'multiple' => true, 'group' => 'property_documents'],
            'property_photos_front' => ['label' => 'Collateral Photos — Front View', 'required' => true, 'multiple' => true],
            'property_photos_side' => ['label' => 'Collateral Photos — Side View', 'required' => false, 'multiple' => true],
            'property_photos_interior' => ['label' => 'Collateral Photos — Interior', 'required' => false, 'multiple' => true],
            'property_photos_additional' => ['label' => 'Collateral Photos — Additional', 'required' => false, 'multiple' => true],
            'valid_id_front' => ['label' => 'Valid ID — Front', 'required' => true, 'multiple' => true],
            'valid_id_back' => ['label' => 'Valid ID — Back', 'required' => true, 'multiple' => true],
            'proof_of_income' => ['label' => 'Proof of Income', 'required' => true, 'multiple' => true],
        ],
        'sss_pension' => [
            'acop' => [
                'label' => 'ACOP (Annual Confirmation of Pensioners)',
                'description' => 'Latest ACOP document issued by SSS or GSIS.',
                'required' => true,
                'multiple' => true,
            ],
            'barangay_certificate' => [
                'label' => 'Barangay Certificate',
                'description' => 'Proof of current residence.',
                'required' => true,
                'multiple' => true,
            ],
            'proof_of_billing' => [
                'label' => 'Proof of Billing',
                'description' => 'Recent utility or service bill showing your current address.',
                'required' => true,
                'multiple' => true,
                'accepted' => ['Water bill', 'Electric bill', 'Internet bill', 'Cable bill', 'Telephone bill'],
            ],
            'valid_government_id' => [
                'label' => 'Valid Government ID',
                'description' => 'Clear copy of a valid government-issued ID. Upload front and back when applicable.',
                'required' => true,
                'multiple' => true,
                'accepted' => ['PhilSys ID', 'UMID', "Driver's License", 'Passport', 'Senior Citizen ID'],
            ],
            'bank_statement' => [
                'label' => 'Bank Statement',
                'description' => 'Optional. Recent bank statement if available.',
                'required' => false,
                'multiple' => true,
            ],
        ],
        'travel_assistance' => [
            'valid_government_id' => [
                'label' => 'Valid Government ID',
                'description' => 'Clear copy of a valid government-issued ID. Upload front and back when applicable.',
                'required' => true,
                'multiple' => true,
                'borrower_visible' => true,
                'accepted' => ['PhilSys ID', 'UMID', "Driver's License", 'Passport', 'Senior Citizen ID'],
            ],
            'proof_of_income' => [
                'label' => 'Proof of Income',
                'description' => 'Payslip, ITR, bank statement, or other proof of income.',
                'required' => true,
                'multiple' => true,
                'borrower_visible' => true,
            ],
            'proof_of_billing' => [
                'label' => 'Proof of Billing',
                'description' => 'Recent utility or service bill showing your current address.',
                'required' => true,
                'multiple' => true,
                'borrower_visible' => true,
                'accepted' => ['Water bill', 'Electric bill', 'Internet bill', 'Cable bill', 'Telephone bill'],
            ],
            'certificate_of_employment' => [
                'label' => 'Certificate of Employment',
                'description' => 'Required when applicable for employed applicants.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => true,
            ],
            'passport' => [
                'label' => 'Passport',
                'description' => 'Upload if already available. Not required at application stage.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => true,
            ],
            'supporting_documents' => [
                'label' => 'Other Supporting Documents',
                'description' => 'Optional supporting documents such as contracts, school acceptance, or agency papers.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => true,
            ],
            'travel_itinerary' => [
                'label' => 'Travel Itinerary',
                'description' => 'Internal document — uploaded by staff or travel agency after application.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => false,
            ],
            'flight_booking' => [
                'label' => 'Flight Booking',
                'description' => 'Internal document — uploaded by staff or travel agency after application.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => false,
            ],
            'hotel_reservation' => [
                'label' => 'Hotel Reservation',
                'description' => 'Internal document — uploaded by staff or travel agency after application.',
                'required' => false,
                'multiple' => true,
                'borrower_visible' => false,
            ],
            'job_offer' => ['label' => 'Job Offer', 'required' => false, 'multiple' => true, 'borrower_visible' => false],
            'poea_documents' => ['label' => 'POEA Documents', 'required' => false, 'multiple' => true, 'borrower_visible' => false],
            'employment_contract' => ['label' => 'Employment Contract', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'agency_certification' => ['label' => 'Agency Certification', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'medical_clearance' => ['label' => 'Medical Clearance', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'valid_id' => ['label' => 'Valid ID', 'required' => false, 'multiple' => true, 'borrower_visible' => false],
            'seamans_book' => ['label' => "Seaman's Book", 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'contract' => ['label' => 'Contract', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'medical_certificate' => ['label' => 'Medical Certificate', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'school_acceptance_letter' => ['label' => 'School Acceptance Letter', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
            'sponsor_affidavit' => ['label' => 'Sponsor Affidavit', 'required' => false, 'multiple' => false, 'borrower_visible' => false],
        ],
    ],

    /*
    | Legacy purpose map retained for reference; borrower wizard uses product/config document_requirements.
    */
    'travel_assistance_documents_by_purpose' => [
        'OFW Deployment' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'certificate_of_employment', 'passport', 'supporting_documents'],
        'Tourist Travel' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
        'Business Travel' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
        'Educational Travel' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
        'Medical Travel' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
        'Seafarer Deployment' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'certificate_of_employment', 'passport', 'supporting_documents'],
        'Immigration Processing' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
        'Other' => ['valid_government_id', 'proof_of_income', 'proof_of_billing', 'passport', 'supporting_documents'],
    ],

    /*
    | Extra structured fields per loan_type (stored in form_data JSON).
    | type: text | textarea | numeric
    | required: only enforced when loan_type matches
    */
    'general_form_fields' => [
        'salary' => [
            ['key' => 'employer_name', 'label' => 'Employer name', 'type' => 'text', 'required' => true],
            ['key' => 'employer_address', 'label' => 'Employer address', 'type' => 'textarea', 'required' => true],
            ['key' => 'employer_phone', 'label' => 'Employer phone', 'type' => 'text', 'required' => false],
            ['key' => 'monthly_salary', 'label' => 'Monthly gross salary (PHP)', 'type' => 'numeric', 'required' => true],
        ],
        'chattel' => [
            ['key' => 'vehicle_description', 'label' => 'Vehicle / collateral description', 'type' => 'textarea', 'required' => true],
            ['key' => 'plate_number', 'label' => 'Plate / serial no.', 'type' => 'text', 'required' => true],
            ['key' => 'comaker_name', 'label' => 'Co-maker full name', 'type' => 'text', 'required' => true],
            ['key' => 'comaker_phone', 'label' => 'Co-maker phone', 'type' => 'text', 'required' => true],
            ['key' => 'comaker_email', 'label' => 'Co-maker email', 'type' => 'text', 'required' => false],
        ],
        'real_estate' => [
            ['key' => 'property_location', 'label' => 'Property location', 'type' => 'textarea', 'required' => false],
        ],
        'sss_pension' => [
            ['key' => 'pension_type', 'label' => 'Pension type (SSS / GSIS / other)', 'type' => 'text', 'required' => true],
        ],
    ],

    /*
    | Borrower multi-step wizard — common fields (flat keys in form_data).
    | required_for_loan_types: null = always required once loan_type is set; else list of loan_type keys.
    */
    'wizard_common' => [
        ['group' => 'personal', 'key' => 'full_name', 'label' => 'Full name', 'type' => 'text', 'required_for_loan_types' => null],
        ['group' => 'personal', 'key' => 'email', 'label' => 'Email', 'type' => 'email', 'required_for_loan_types' => null],
        ['group' => 'personal', 'key' => 'phone', 'label' => 'Mobile number', 'type' => 'text', 'required_for_loan_types' => null],
        ['group' => 'personal', 'key' => 'address', 'label' => 'Current address', 'type' => 'textarea', 'required_for_loan_types' => null],
        ['group' => 'personal', 'key' => 'birthdate', 'label' => 'Date of birth', 'type' => 'date', 'required_for_loan_types' => null],
        ['group' => 'personal', 'key' => 'tin', 'label' => 'TIN', 'type' => 'text', 'required_for_loan_types' => null],
        ['group' => 'employment', 'key' => 'employment_status', 'label' => 'Employment status', 'type' => 'text', 'required_for_loan_types' => ['salary', 'chattel', 'real_estate', 'sss_pension']],
        ['group' => 'employment', 'key' => 'employer_business_name', 'label' => 'Employer / business name', 'type' => 'text', 'required_for_loan_types' => ['salary', 'chattel']],
        ['group' => 'employment', 'key' => 'job_title', 'label' => 'Position / title', 'type' => 'text', 'required_for_loan_types' => ['salary', 'chattel']],
        ['group' => 'employment', 'key' => 'years_in_work', 'label' => 'Years in current work', 'type' => 'numeric', 'required_for_loan_types' => ['salary', 'chattel']],
        ['group' => 'financial', 'key' => 'monthly_income', 'label' => 'Total monthly income (PHP)', 'type' => 'numeric', 'required_for_loan_types' => null],
        ['group' => 'financial', 'key' => 'monthly_expenses', 'label' => 'Monthly expenses (PHP)', 'type' => 'numeric', 'required_for_loan_types' => null],
        ['group' => 'financial', 'key' => 'other_debts', 'label' => 'Other monthly debt payments (PHP)', 'type' => 'numeric', 'required_for_loan_types' => []],
    ],

    'travel_documents' => [
        'passport' => ['label' => 'Passport', 'required' => true, 'multiple' => false],
        'valid_ids' => ['label' => 'Two (2) valid IDs', 'required' => true, 'multiple' => true],
        'photo_2x2' => ['label' => '2×2 picture', 'required' => true, 'multiple' => false],
        'visa' => ['label' => 'Visa (if applicable)', 'required' => false, 'multiple' => false],
        'cedula' => ['label' => 'Community Tax Certificate (Cedula)', 'required' => true, 'multiple' => false],
    ],

    /*
    | Staff-only property appraisal fields (real estate mortgage).
    | Encoded by Admin, Loan Officer, or CI — not exposed in borrower wizard schema.
    */
    'property_staff_appraisal_fields' => [
        ['key' => 'property_type', 'label' => 'Property Type', 'type' => 'select', 'options' => ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Lot Only', 'Other']],
        ['key' => 'title_number', 'label' => 'Title Number', 'type' => 'text'],
        ['key' => 'tax_declaration_number', 'label' => 'Tax Declaration Number', 'type' => 'text'],
        ['key' => 'property_address', 'label' => 'Property Address', 'type' => 'textarea'],
        ['key' => 'lot_area', 'label' => 'Lot Area (sqm)', 'type' => 'numeric'],
        ['key' => 'floor_area', 'label' => 'Floor Area (sqm)', 'type' => 'numeric'],
        ['key' => 'market_value', 'label' => 'Market Value (PHP)', 'type' => 'numeric'],
        ['key' => 'assessed_value', 'label' => 'Assessed Value (PHP)', 'type' => 'numeric'],
        ['key' => 'appraised_value', 'label' => 'Appraised Value (PHP)', 'type' => 'numeric'],
        ['key' => 'loanable_percentage', 'label' => 'Loanable Percentage (%)', 'type' => 'numeric'],
        ['key' => 'loanable_value', 'label' => 'Loanable Value (PHP)', 'type' => 'numeric', 'computed' => true],
        ['key' => 'evaluation_remarks', 'label' => 'Evaluation Remarks', 'type' => 'textarea'],
    ],

    /*
    | Document keys shown on borrower Property Information step (real estate).
    */
    'real_estate_property_step_documents' => [
        'land_title',
        'tax_declaration',
        'lot_plan',
        'property_sketch',
        'tax_clearance',
        'property_photos_front',
        'property_photos_side',
        'property_photos_interior',
        'property_photos_additional',
    ],
];
