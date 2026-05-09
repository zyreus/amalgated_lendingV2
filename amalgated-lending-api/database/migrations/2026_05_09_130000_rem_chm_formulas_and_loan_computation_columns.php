<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

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
            $rules['mortgage_fee_rate'] = (float) ($rules['mortgage_fee_rate'] ?? 0.02);
            if ($rules['mortgage_fee_rate'] > 0.021) {
                $rules['mortgage_fee_rate'] = 0.02;
            }
            $rules['notarial_fee_new'] = (float) ($rules['notarial_fee_new'] ?? 1500);
            $rules['notarial_fee_reloan'] = (float) ($rules['notarial_fee_reloan'] ?? 175);
            if (! array_key_exists('re_loan_fee', $rules)) {
                $rules['re_loan_fee'] = 0.0;
            }

            DB::table('loan_products')->where('slug', $slug)->update(['rules' => json_encode($rules)]);
        }

        $salary = DB::table('loan_products')->where('slug', 'salary-loan')->first();
        if ($salary && ! empty($salary->rules)) {
            $rules = json_decode((string) $salary->rules, true);
            if (is_array($rules)) {
                $rules['notarial_fee_new'] = (float) ($rules['notarial_fee_new'] ?? 350);
                $rules['notarial_fee_reloan'] = (float) ($rules['notarial_fee_reloan'] ?? 350);
                DB::table('loan_products')->where('slug', 'salary-loan')->update(['rules' => json_encode($rules)]);
            }
        }

        Schema::table('loans', function (Blueprint $table) {
            if (! Schema::hasColumn('loans', 'adjusted_monthly_rate_percent')) {
                $table->decimal('adjusted_monthly_rate_percent', 10, 4)->nullable()->after('annual_interest_rate');
            }
            if (! Schema::hasColumn('loans', 'whole_term_interest_percent')) {
                $table->decimal('whole_term_interest_percent', 12, 4)->nullable()->after('adjusted_monthly_rate_percent');
            }
            if (! Schema::hasColumn('loans', 'monthly_principal')) {
                $table->decimal('monthly_principal', 15, 2)->nullable()->after('whole_term_interest_percent');
            }
            if (! Schema::hasColumn('loans', 'monthly_interest')) {
                $table->decimal('monthly_interest', 15, 2)->nullable()->after('monthly_principal');
            }
            if (! Schema::hasColumn('loans', 'service_charge')) {
                $table->decimal('service_charge', 15, 2)->nullable()->after('monthly_interest');
            }
            if (! Schema::hasColumn('loans', 'mri_fee')) {
                $table->decimal('mri_fee', 15, 2)->nullable()->after('service_charge');
            }
            if (! Schema::hasColumn('loans', 'doc_stamp')) {
                $table->decimal('doc_stamp', 15, 2)->nullable()->after('mri_fee');
            }
            if (! Schema::hasColumn('loans', 'notarial_fee')) {
                $table->decimal('notarial_fee', 15, 2)->nullable()->after('doc_stamp');
            }
            if (! Schema::hasColumn('loans', 'mortgage_fee')) {
                $table->decimal('mortgage_fee', 15, 2)->nullable()->after('notarial_fee');
            }
            if (! Schema::hasColumn('loans', 'total_deductions')) {
                $table->decimal('total_deductions', 15, 2)->nullable()->after('mortgage_fee');
            }
            if (! Schema::hasColumn('loans', 'net_proceeds')) {
                $table->decimal('net_proceeds', 15, 2)->nullable()->after('total_deductions');
            }
            if (! Schema::hasColumn('loans', 'total_payment')) {
                $table->decimal('total_payment', 15, 2)->nullable()->after('total_interest');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            foreach ([
                'total_payment',
                'net_proceeds',
                'total_deductions',
                'mortgage_fee',
                'notarial_fee',
                'doc_stamp',
                'mri_fee',
                'service_charge',
                'monthly_interest',
                'monthly_principal',
                'whole_term_interest_percent',
                'adjusted_monthly_rate_percent',
            ] as $col) {
                if (Schema::hasColumn('loans', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
