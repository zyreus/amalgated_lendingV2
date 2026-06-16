<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('loan_products')->where('slug', 'travel-assistance-loan')->first();
        if (! $row) {
            return;
        }

        $config = [];
        if (! empty($row->calculator_config)) {
            $decoded = json_decode((string) $row->calculator_config, true);
            $config = is_array($decoded) ? $decoded : [];
        }

        unset($config['fixed_term_months'], $config['term_structure']);
        $config['fee_profile'] = 'travel';
        $config['max_principal'] = 500000;
        $config['min_principal'] = 10000;
        $config['opening_account_fee'] = $config['opening_account_fee'] ?? 10000;

        DB::table('loan_products')->where('slug', 'travel-assistance-loan')->update([
            'name' => 'Travel Assistance Loan',
            'description' => 'Travel cost financing for OFWs, seafarers, students, tourists, and professionals.',
            'max_term' => 36,
            'max_amount' => 500000,
            'calculator_config' => json_encode($config),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        $row = DB::table('loan_products')->where('slug', 'travel-assistance-loan')->first();
        if (! $row) {
            return;
        }

        $config = [];
        if (! empty($row->calculator_config)) {
            $decoded = json_decode((string) $row->calculator_config, true);
            $config = is_array($decoded) ? $decoded : [];
        }

        $config['fixed_term_months'] = 1;
        $config['term_structure'] = 'monthly_renewal';
        $config['fee_profile'] = 'travel';
        $config['max_principal'] = 2000000;
        unset($config['min_principal']);

        DB::table('loan_products')->where('slug', 'travel-assistance-loan')->update([
            'name' => 'Travel Assistance (Work Abroad)',
            'description' => 'Support for documented overseas workers.',
            'max_term' => 1,
            'max_amount' => 2000000,
            'calculator_config' => json_encode($config),
            'updated_at' => now(),
        ]);
    }
};
