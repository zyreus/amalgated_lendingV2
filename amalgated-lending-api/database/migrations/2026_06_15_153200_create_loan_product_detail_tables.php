<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('salary_loan_details')) {
            Schema::create('salary_loan_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_application_id')->unique()->constrained('loan_applications')->cascadeOnDelete();
                $table->string('full_name')->nullable();
                $table->date('birthdate')->nullable();
                $table->string('civil_status', 40)->nullable();
                $table->text('address')->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('employer_name')->nullable();
                $table->text('company_address')->nullable();
                $table->string('position')->nullable();
                $table->string('employment_type', 80)->nullable();
                $table->decimal('years_of_service', 8, 2)->nullable();
                $table->decimal('monthly_gross_salary', 15, 2)->nullable();
                $table->decimal('monthly_net_salary', 15, 2)->nullable();
                $table->decimal('other_income', 15, 2)->nullable();
                $table->text('loan_purpose')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('chattel_mortgage_details')) {
            Schema::create('chattel_mortgage_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_application_id')->unique()->constrained('loan_applications')->cascadeOnDelete();
                $table->string('full_name')->nullable();
                $table->date('birthdate')->nullable();
                $table->string('civil_status', 40)->nullable();
                $table->text('address')->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('vehicle_type')->nullable();
                $table->string('brand')->nullable();
                $table->string('model')->nullable();
                $table->unsignedSmallInteger('year_model')->nullable();
                $table->string('plate_number', 80)->nullable();
                $table->string('engine_number')->nullable();
                $table->string('chassis_number')->nullable();
                $table->string('or_number')->nullable();
                $table->string('cr_number')->nullable();
                $table->decimal('market_value', 15, 2)->nullable();
                $table->text('loan_purpose')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('real_estate_details')) {
            Schema::create('real_estate_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_application_id')->unique()->constrained('loan_applications')->cascadeOnDelete();
                $table->string('full_name')->nullable();
                $table->date('birthdate')->nullable();
                $table->string('civil_status', 40)->nullable();
                $table->text('address')->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('property_type')->nullable();
                $table->string('title_number')->nullable();
                $table->string('tax_declaration_number')->nullable();
                $table->text('property_address')->nullable();
                $table->decimal('lot_area', 12, 2)->nullable();
                $table->decimal('floor_area', 12, 2)->nullable();
                $table->decimal('market_value', 15, 2)->nullable();
                $table->decimal('assessed_value', 15, 2)->nullable();
                $table->text('loan_purpose')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('pension_loan_details')) {
            Schema::create('pension_loan_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_application_id')->unique()->constrained('loan_applications')->cascadeOnDelete();
                $table->string('full_name')->nullable();
                $table->date('birthdate')->nullable();
                $table->string('civil_status', 40)->nullable();
                $table->text('address')->nullable();
                $table->string('phone', 40)->nullable();
                $table->string('pension_type', 20)->nullable();
                $table->string('sss_number')->nullable();
                $table->string('gsis_bp_number')->nullable();
                $table->decimal('monthly_pension', 15, 2)->nullable();
                $table->date('pension_start_date')->nullable();
                $table->string('bank_account_number')->nullable();
                $table->text('loan_purpose')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pension_loan_details');
        Schema::dropIfExists('real_estate_details');
        Schema::dropIfExists('chattel_mortgage_details');
        Schema::dropIfExists('salary_loan_details');
    }
};
