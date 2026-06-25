<?php

use App\Models\LoanProduct;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $product = LoanProduct::query()->where('slug', 'sss-pension-loan')->first();
        if (! $product) {
            return;
        }

        $rules = is_array($product->rules) ? $product->rules : [];
        $rules['pension_retention_threshold'] = 300;
        $rules['pension_retention_threshold_sss'] = 100;
        $rules['pension_retention_threshold_gsis'] = 300;

        foreach (['nw', 'rl'] as $nature) {
            foreach (['sss' => 100, 'gsis' => 300] as $system => $amount) {
                $key = "pension_retention_threshold_{$nature}_{$system}";
                if (! isset($rules[$key]) || (float) $rules[$key] >= 1000) {
                    $rules[$key] = $amount;
                }
            }
        }

        $product->update(['rules' => $rules]);
    }

    public function down(): void
    {
        $product = LoanProduct::query()->where('slug', 'sss-pension-loan')->first();
        if (! $product) {
            return;
        }

        $rules = is_array($product->rules) ? $product->rules : [];
        $rules['pension_retention_threshold'] = 1000;
        $rules['pension_retention_threshold_sss'] = 1000;
        $rules['pension_retention_threshold_gsis'] = 1000;

        foreach (['nw', 'rl'] as $nature) {
            foreach (['sss', 'gsis'] as $system) {
                $key = "pension_retention_threshold_{$nature}_{$system}";
                if (isset($rules[$key]) && in_array((float) $rules[$key], [100.0, 300.0], true)) {
                    unset($rules[$key]);
                }
            }
        }

        $product->update(['rules' => $rules]);
    }
};
