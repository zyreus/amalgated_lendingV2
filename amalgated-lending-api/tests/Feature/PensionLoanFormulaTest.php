<?php

namespace Tests\Feature;

use App\Models\LoanProduct;
use App\Services\LoanCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class PensionLoanFormulaTest extends TestCase
{
    use RefreshDatabase;

    private function seedPensionProduct(): void
    {
        LoanProduct::query()->updateOrCreate(['slug' => 'sss-pension-loan'], [
            'code' => 'PEN',
            'name' => 'Pension Loan',
            'interest_rate' => 2.24,
            'rate_type' => 'monthly',
            'max_term' => 36,
            'status' => 'active',
            'calculator_config' => [
                'fee_profile' => 'pension',
                'computation_style' => 'straight_line',
                'pension_multiplier' => 18.75,
                'max_principal' => 1000000,
            ],
            'rules' => [
                'service_charge_mode' => 'fixed',
                'service_charge_fixed_nw_sss' => 2750,
                'service_charge_fixed_rl_sss' => 2000,
                'insurance_per_1000' => 35,
                'insurance_fixed' => 0,
                'doc_stamp_per_200' => 1.5,
                'notarial_fee_nw_sss' => 350,
                'notarial_fee_rl_sss' => 175,
                'pension_retention_threshold' => 100,
                'pension_retention_threshold_sss' => 100,
            ],
        ]);
    }

    public function test_pension_formula_matches_official_example_for_reloan(): void
    {
        $this->seedPensionProduct();
        $calc = app(LoanCalculator::class)->compute([
            'product_slug' => 'sss-pension-loan',
            'loan_amount' => 30000,
            'term_months' => 24,
            'application_nature' => 'reloan',
            'monthly_pension' => 3000,
            'pension_type' => 'SSS',
        ]);

        $b = $calc['breakdown'] ?? [];
        $this->assertSame(1250.00, (float) ($b['monthly_principal'] ?? 0));
        $this->assertSame(672.00, (float) ($b['monthly_interest'] ?? 0));
        $this->assertSame(1922.00, (float) ($b['monthly_amortization'] ?? 0));
        $this->assertSame(3450.00, (float) ($b['total_deductions'] ?? 0));
        $this->assertSame(26550.00, (float) ($b['net_proceeds'] ?? 0));
        $this->assertSame(1078.00, (float) ($b['remaining_pension'] ?? 0));
    }

    public function test_pension_retention_threshold_blocks_over_deduction(): void
    {
        $this->seedPensionProduct();

        $this->expectException(ValidationException::class);
        app(LoanCalculator::class)->compute([
            'product_slug' => 'sss-pension-loan',
            'loan_amount' => 30000,
            'term_months' => 24,
            'application_nature' => 'reloan',
            'monthly_pension' => 2000,
            'pension_type' => 'SSS',
        ]);
    }
}
