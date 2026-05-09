<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $row = DB::table('loan_products')->where('slug', 'sss-pension-loan')->first();
        if (! $row) {
            return;
        }

        $cfg = json_decode((string) ($row->calculator_config ?? '{}'), true);
        if (! is_array($cfg)) {
            $cfg = [];
        }
        $cfg['computation_style'] = 'straight_line';
        $cfg['fee_profile'] = 'pension';

        $rules = json_decode((string) ($row->rules ?? '{}'), true);
        if (! is_array($rules)) {
            $rules = [];
        }
        $rules['service_charge_mode'] = 'fixed';
        $rules['service_charge_fixed_new'] = 2750;
        $rules['service_charge_fixed_reloan'] = 2750;
        $rules['service_charge_fixed_nw_sss'] = 2750;
        $rules['service_charge_fixed_nw_gsis'] = 2750;
        $rules['service_charge_fixed_rl_sss'] = 2000;
        $rules['service_charge_fixed_rl_gsis'] = 2000;
        $rules['insurance_per_1000'] = 35;
        $rules['insurance_fixed'] = 0;
        $rules['doc_stamp_per_200'] = 1.5;
        $rules['notarial_fee_new'] = 350;
        $rules['notarial_fee_reloan'] = 350;
        $rules['notarial_fee_nw_sss'] = 350;
        $rules['notarial_fee_nw_gsis'] = 350;
        $rules['notarial_fee_rl_sss'] = 175;
        $rules['notarial_fee_rl_gsis'] = 175;
        $rules['pension_retention_threshold'] = 1000;
        $rules['pension_retention_threshold_sss'] = 1000;
        $rules['pension_retention_threshold_gsis'] = 1000;

        DB::table('loan_products')
            ->where('slug', 'sss-pension-loan')
            ->update([
                'calculator_config' => json_encode($cfg, JSON_UNESCAPED_UNICODE),
                'rules' => json_encode($rules, JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // Intentionally no-op to avoid reverting policy edits.
    }
};
