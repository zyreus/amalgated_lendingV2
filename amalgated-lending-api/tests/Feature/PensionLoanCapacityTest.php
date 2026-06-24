<?php

namespace Tests\Feature;

use App\Models\LoanProduct;
use App\Services\PensionLoanCapacityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PensionLoanCapacityTest extends TestCase
{
    use RefreshDatabase;

    private function seedPensionProduct(): LoanProduct
    {
        return LoanProduct::query()->updateOrCreate(['slug' => 'sss-pension-loan'], [
            'code' => 'PEN',
            'name' => 'Pension Loan',
            'interest_rate' => 2.24,
            'rate_type' => 'monthly',
            'max_term' => 36,
            'status' => 'active',
            'calculator_config' => [
                'fee_profile' => 'pension',
                'computation_style' => 'straight_line',
                'pension_multiplier' => 19.2,
                'max_principal' => 1000000,
            ],
            'rules' => [
                'service_charge_mode' => 'fixed',
                'service_charge_fixed_nw_sss' => 2750,
                'service_charge_fixed_rl_sss' => 2000,
                'insurance_per_1000' => 35,
                'doc_stamp_per_200' => 1.5,
                'notarial_fee_nw_sss' => 350,
                'notarial_fee_rl_sss' => 175,
                'pension_retention_threshold' => 100,
            ],
        ]);
    }

    public function test_capacity_example_matches_business_preview(): void
    {
        $product = $this->seedPensionProduct();
        $service = app(PensionLoanCapacityService::class);

        $estimate = $service->estimateFromPension($product, [
            'monthly_pension' => 5000,
            'term_months' => 36,
            'application_nature' => 'new',
            'pension_type' => 'SSS',
        ]);

        $this->assertTrue($estimate['eligible']);
        $this->assertEqualsWithDelta(96000.0, (float) $estimate['estimated_loanable_amount'], 1.0);
        $this->assertEqualsWithDelta(2666.67, (float) $estimate['monthly_principal'], 0.05);
        $this->assertEqualsWithDelta(2150.40, (float) $estimate['monthly_interest'], 0.05);
        $this->assertEqualsWithDelta(4817.07, (float) $estimate['monthly_deduction'], 0.1);
        $this->assertEqualsWithDelta(182.93, (float) $estimate['remaining_pension'], 0.1);
    }
}
