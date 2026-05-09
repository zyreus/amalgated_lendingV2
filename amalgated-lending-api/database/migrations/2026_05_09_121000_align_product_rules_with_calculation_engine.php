<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['real-estate-mortgage', 'chattel-mortgage'] as $slug) {
            $row = DB::table('loan_products')->where('slug', $slug)->first();
            if (! $row) {
                continue;
            }
            $rules = [];
            if (! empty($row->rules)) {
                $decoded = json_decode((string) $row->rules, true);
                $rules = is_array($decoded) ? $decoded : [];
            }
            $rules['re_loan_fee'] = (float) ($rules['re_loan_fee'] ?? 1500);
            DB::table('loan_products')->where('slug', $slug)->update(['rules' => json_encode($rules)]);
        }

        $salary = DB::table('loan_products')->where('slug', 'salary-loan')->first();
        if ($salary) {
            $cfg = [];
            if (! empty($salary->calculator_config)) {
                $decoded = json_decode((string) $salary->calculator_config, true);
                $cfg = is_array($decoded) ? $decoded : [];
            }
            $cfg['computation_style'] = 'amortized';
            if (empty($cfg['fee_profile'])) {
                $cfg['fee_profile'] = 'salary';
            }
            DB::table('loan_products')->where('slug', 'salary-loan')->update(['calculator_config' => json_encode($cfg)]);
        }

        $appliance = DB::table('loan_products')->where('slug', 'appliance')->first();
        if ($appliance) {
            $rules = [];
            if (! empty($appliance->rules)) {
                $decoded = json_decode((string) $appliance->rules, true);
                $rules = is_array($decoded) ? $decoded : [];
            }
            $rules['outside_office_downpayment_rate'] = (float) ($rules['outside_office_downpayment_rate'] ?? 0.15);
            $rules['in_office_downpayment_rate'] = (float) ($rules['in_office_downpayment_rate'] ?? 0);
            $rules['default_purchase_channel'] = (string) ($rules['default_purchase_channel'] ?? 'outside_office');
            DB::table('loan_products')->where('slug', 'appliance')->update(['rules' => json_encode($rules)]);
        }
    }

    public function down(): void
    {
        foreach (['real-estate-mortgage', 'chattel-mortgage'] as $slug) {
            $row = DB::table('loan_products')->where('slug', $slug)->first();
            if (! $row || empty($row->rules)) {
                continue;
            }
            $rules = json_decode((string) $row->rules, true);
            if (! is_array($rules)) {
                continue;
            }
            unset($rules['re_loan_fee']);
            DB::table('loan_products')->where('slug', $slug)->update(['rules' => json_encode($rules)]);
        }

        $salary = DB::table('loan_products')->where('slug', 'salary-loan')->first();
        if ($salary && ! empty($salary->calculator_config)) {
            $cfg = json_decode((string) $salary->calculator_config, true);
            if (is_array($cfg)) {
                unset($cfg['computation_style']);
                DB::table('loan_products')->where('slug', 'salary-loan')->update(['calculator_config' => json_encode($cfg)]);
            }
        }

        $appliance = DB::table('loan_products')->where('slug', 'appliance')->first();
        if ($appliance && ! empty($appliance->rules)) {
            $rules = json_decode((string) $appliance->rules, true);
            if (is_array($rules)) {
                unset($rules['outside_office_downpayment_rate'], $rules['in_office_downpayment_rate'], $rules['default_purchase_channel']);
                DB::table('loan_products')->where('slug', 'appliance')->update(['rules' => json_encode($rules)]);
            }
        }
    }
};
