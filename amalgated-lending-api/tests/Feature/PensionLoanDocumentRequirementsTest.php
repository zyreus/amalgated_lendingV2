<?php

namespace Tests\Feature;

use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Models\User;
use App\Services\LoanProductDocumentRequirementsService;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PensionLoanDocumentRequirementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_pension_defaults_require_acop_not_legacy_pension_id(): void
    {
        $service = app(LoanProductDocumentRequirementsService::class);
        $defs = $service->definitions(LoanApplication::TYPE_SSS_PENSION, null);

        $this->assertArrayHasKey('acop', $defs);
        $this->assertArrayHasKey('barangay_certificate', $defs);
        $this->assertArrayHasKey('proof_of_billing', $defs);
        $this->assertArrayHasKey('valid_government_id', $defs);
        $this->assertArrayHasKey('bank_statement', $defs);
        $this->assertFalse($defs['bank_statement']['required']);
        $this->assertTrue($defs['acop']['multiple']);
        $this->assertArrayNotHasKey('pension_id', $defs);
        $this->assertArrayNotHasKey('pension_voucher', $defs);
    }

    public function test_product_override_replaces_defaults(): void
    {
        $product = LoanProduct::query()->create([
            'slug' => 'sss-pension-loan-test',
            'code' => 'PEN-T',
            'name' => 'Pension Test',
            'interest_rate' => 2.24,
            'rate_type' => 'monthly',
            'status' => 'active',
            'rules' => [
                'document_requirements' => [
                    'custom_memo' => [
                        'label' => 'Custom Memo',
                        'required' => true,
                        'multiple' => true,
                    ],
                ],
            ],
        ]);

        $service = app(LoanProductDocumentRequirementsService::class);
        $defs = $service->definitions(LoanApplication::TYPE_SSS_PENSION, $product);

        $this->assertArrayHasKey('custom_memo', $defs);
        $this->assertArrayNotHasKey('acop', $defs);
    }

    public function test_document_validation_flags_missing_required_pension_docs(): void
    {
        $product = LoanProduct::query()->create([
            'slug' => 'sss-pension-loan-check',
            'code' => 'PEN-C',
            'name' => 'Pension Check',
            'interest_rate' => 2.24,
            'rate_type' => 'monthly',
            'status' => 'active',
            'rules' => [
                'document_requirements' => config('amalgated_loans.general_documents.sss_pension'),
            ],
        ]);

        $user = User::factory()->create();

        $app = LoanApplication::query()->create([
            'user_id' => $user->id,
            'loan_type' => LoanApplication::TYPE_SSS_PENSION,
            'loan_product_id' => $product->id,
            'status' => LoanApplication::STATUS_DRAFT,
            'documents' => [],
        ]);

        $status = LoanApplicationDocumentStatus::forApplication($app);
        $this->assertFalse($status['acop']['ok']);
        $this->assertTrue($status['bank_statement']['ok']);
    }
}
