<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('loan_products')->where('slug', 'salary-loan')->first();
        if (! $row) {
            return;
        }

        $cfg = json_decode((string) ($row->calculator_config ?? '{}'), true);
        if (! is_array($cfg)) {
            $cfg = [];
        }
        $cfg['fee_profile'] = 'salary';
        $cfg['salary_principal_multiplier'] = (float) ($cfg['salary_principal_multiplier'] ?? 6);
        $cfg['computation_style'] = 'straight_line';

        $rules = json_decode((string) ($row->rules ?? '{}'), true);
        if (! is_array($rules)) {
            $rules = [];
        }
        $rules['service_charge_rate'] = 0.015;
        $rules['insurance_mode'] = 'percent';
        $rules['insurance_rate'] = 0.035;
        $rules['insurance_per_1000'] = 0;
        $rules['insurance_fixed'] = 0;
        $rules['doc_stamp_rate_decimal'] = 0.0075;
        $rules['notarial_fee_new'] = 175;
        $rules['notarial_fee_reloan'] = 175;

        DB::table('loan_products')
            ->where('slug', 'salary-loan')
            ->update([
                'calculator_config' => json_encode($cfg, JSON_UNESCAPED_UNICODE),
                'rules' => json_encode($rules, JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Intentionally no-op: rules may be edited in admin and should not be force-reverted.
    }
};
