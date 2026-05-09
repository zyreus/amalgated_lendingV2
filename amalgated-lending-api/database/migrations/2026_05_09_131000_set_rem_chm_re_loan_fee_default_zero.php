<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
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
            $rules['re_loan_fee'] = 0.0;
            DB::table('loan_products')->where('slug', $slug)->update(['rules' => json_encode($rules)]);
        }
    }

    public function down(): void
    {
        // Intentionally left blank — prior re_loan_fee values were environment-specific.
    }
};
