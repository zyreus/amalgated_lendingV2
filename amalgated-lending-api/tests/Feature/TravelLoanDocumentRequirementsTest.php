<?php

namespace Tests\Feature;

use App\Models\LoanApplication;
use App\Models\LoanProduct;
use App\Models\User;
use App\Services\LoanCalculator;
use App\Services\LoanProductDocumentRequirementsService;
use App\Support\LoanApplicationDocumentStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TravelLoanDocumentRequirementsTest extends TestCase
{
    use RefreshDatabase;

    public function test_travel_defaults_exclude_agency_documents(): void
    {
        $service = app(LoanProductDocumentRequirementsService::class);
        $defs = $service->definitions(LoanApplication::TYPE_TRAVEL_ASSISTANCE, null);

        $this->assertArrayHasKey('valid_government_id', $defs);
        $this->assertArrayHasKey('proof_of_income', $defs);
        $this->assertArrayHasKey('proof_of_billing', $defs);
        $this->assertArrayHasKey('passport', $defs);
        $this->assertFalse($defs['passport']['required']);
        $this->assertArrayNotHasKey('travel_itinerary', $defs);
        $this->assertArrayNotHasKey('flight_booking', $defs);
        $this->assertArrayNotHasKey('hotel_reservation', $defs);
    }

    public function test_travel_product_override_replaces_defaults(): void
    {
        $product = LoanProduct::query()->create([
            'slug' => 'travel-assistance-loan-test',
            'code' => 'TRV-T',
            'name' => 'Travel Test',
            'interest_rate' => 3.5,
            'rate_type' => 'monthly',
            'status' => 'active',
            'rules' => [
                'document_requirements' => [
                    'custom_brief' => [
                        'label' => 'Custom Brief',
                        'required' => true,
                        'multiple' => true,
                    ],
                ],
            ],
        ]);

        $service = app(LoanProductDocumentRequirementsService::class);
        $defs = $service->definitions(LoanApplication::TYPE_TRAVEL_ASSISTANCE, $product);

        $this->assertArrayHasKey('custom_brief', $defs);
        $this->assertArrayNotHasKey('valid_government_id', $defs);
    }

    public function test_travel_computation_skips_borrower_max_amount_cap(): void
    {
        $product = LoanProduct::query()->create([
            'slug' => 'travel-assistance-loan-cap-test',
            'code' => 'TRV',
            'name' => 'Travel Assistance Loan',
            'interest_rate' => 3.5,
            'rate_type' => 'monthly',
            'status' => 'active',
            'max_amount' => 500000,
            'max_term' => 36,
            'calculator_config' => [
                'fee_profile' => 'travel',
                'min_principal' => 10000,
            ],
            'rules' => [],
        ]);

        $calculator = app(LoanCalculator::class);
        $result = $calculator->compute([
            'product_id' => $product->id,
            'loan_amount' => 750000,
            'term_months' => 12,
            'application_nature' => 'new',
            'skip_borrower_amount_caps' => true,
        ]);

        $this->assertSame(750000.0, (float) $result['inputs']['loan_amount']);
    }

    public function test_document_validation_flags_missing_required_travel_docs(): void
    {
        $product = LoanProduct::query()->create([
            'slug' => 'travel-assistance-loan-check',
            'code' => 'TRV-C',
            'name' => 'Travel Check',
            'interest_rate' => 3.5,
            'rate_type' => 'monthly',
            'status' => 'active',
            'rules' => [
                'document_requirements' => array_filter(
                    config('amalgated_loans.general_documents.travel_assistance'),
                    fn (array $meta) => ($meta['borrower_visible'] ?? true) !== false,
                ),
            ],
        ]);

        $user = User::factory()->create();

        $app = LoanApplication::query()->create([
            'user_id' => $user->id,
            'loan_type' => LoanApplication::TYPE_TRAVEL_ASSISTANCE,
            'loan_product_id' => $product->id,
            'status' => LoanApplication::STATUS_DRAFT,
            'documents' => [],
        ]);

        $status = LoanApplicationDocumentStatus::forApplication($app);
        $this->assertFalse($status['valid_government_id']['ok']);
        $this->assertTrue($status['passport']['ok']);
        $this->assertArrayNotHasKey('travel_itinerary', $status);
    }
}
