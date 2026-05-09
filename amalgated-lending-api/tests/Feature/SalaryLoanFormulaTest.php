<?php

namespace Tests\Feature;

use App\Models\LoanProduct;
use App\Services\LoanCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SalaryLoanFormulaTest extends TestCase
{
    use RefreshDatabase;

    public function test_salary_formula_uses_straight_line_and_expected_deductions(): void
    {
        LoanProduct::query()->updateOrCreate(['slug' => 'salary-loan'], [
            'code' => 'SAL',
            'name' => 'Salary Loan',
            'interest_rate' => 1.5,
            'rate_type' => 'monthly',
            'max_term' => 60,
            'status' => 'active',
            'calculator_config' => [
                'fee_profile' => 'salary',
                'computation_style' => 'straight_line',
            ],
            'rules' => [
                'service_charge_rate' => 0.015,
                'insurance_mode' => 'percent',
                'insurance_rate' => 0.035,
                'doc_stamp_rate_decimal' => 0.0075,
                'notarial_fee_new' => 175,
                'notarial_fee_reloan' => 175,
            ],
        ]);

        $calc = app(LoanCalculator::class)->compute([
            'product_slug' => 'salary-loan',
            'loan_amount' => 15000,
            'term_months' => 12,
            'application_nature' => 'new',
        ]);

        $b = $calc['breakdown'] ?? [];

        $this->assertSame(1250.00, (float) ($b['monthly_principal'] ?? 0));
        $this->assertSame(225.00, (float) ($b['monthly_interest'] ?? 0));
        $this->assertSame(1475.00, (float) ($b['monthly_amortization'] ?? 0));
        $this->assertSame(737.50, (float) ($b['semi_monthly_payment'] ?? 0));
        $this->assertSame(1037.50, (float) ($b['total_deductions'] ?? 0));
        $this->assertSame(13962.50, (float) ($b['net_proceeds'] ?? 0));
    }
}
