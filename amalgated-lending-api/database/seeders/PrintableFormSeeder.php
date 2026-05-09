<?php

namespace Database\Seeders;

use App\Models\PrintableForm;
use Illuminate\Database\Seeder;

class PrintableFormSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            [
                'form_key' => 'main_loan_application',
                'title' => 'Loan Application Form',
                'category' => 'lending',
                'branch' => null,
                'description' => 'Single-page compact A4 loan application with personal, employment, loan details, checklist, and signatures.',
                'pdf_version' => '2.0.0',
                'status' => PrintableForm::STATUS_ACTIVE,
                'watermark_enabled' => false,
                'sort_order' => 10,
            ],
            [
                'form_key' => 'co_maker_statement',
                'title' => 'Payment Receipt / Invoice',
                'category' => 'lending',
                'branch' => null,
                'description' => 'Single-page payment receipt and invoice with borrower, payment, totals, and reference sections.',
                'pdf_version' => '2.0.0',
                'status' => PrintableForm::STATUS_ACTIVE,
                'watermark_enabled' => false,
                'sort_order' => 20,
            ],
            [
                'form_key' => 'credit_verification',
                'title' => 'Statement of Account (SOA)',
                'category' => 'credit',
                'branch' => null,
                'description' => 'Single-page SOA with borrower info, loan summary, compact payment schedule, and outstanding balance.',
                'pdf_version' => '2.0.0',
                'status' => PrintableForm::STATUS_ACTIVE,
                'watermark_enabled' => false,
                'sort_order' => 30,
            ],
            [
                'form_key' => 'branch_application',
                'title' => 'Borrower Information Summary',
                'category' => 'operations',
                'branch' => null,
                'description' => 'Single-page borrower profile summary with personal, contact, financial, and compliance details.',
                'pdf_version' => '2.0.0',
                'status' => PrintableForm::STATUS_ACTIVE,
                'watermark_enabled' => false,
                'sort_order' => 40,
            ],
        ];

        foreach ($rows as $row) {
            PrintableForm::updateOrCreate(
                ['form_key' => $row['form_key']],
                $row
            );
        }
    }
}
