<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('travel_assistance_details')) {
            return;
        }

        Schema::create('travel_assistance_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->unique()->constrained('loan_applications')->cascadeOnDelete();
            $table->string('travel_purpose')->nullable()->index();
            $table->string('destination_country')->nullable()->index();
            $table->string('destination_city')->nullable();
            $table->date('departure_date')->nullable();
            $table->date('return_date')->nullable();
            $table->string('visa_status')->nullable();
            $table->string('agency_name')->nullable();
            $table->string('employer_name')->nullable();
            $table->decimal('travel_cost', 15, 2)->nullable();
            $table->decimal('airfare_cost', 15, 2)->nullable();
            $table->decimal('visa_cost', 15, 2)->nullable();
            $table->decimal('medical_cost', 15, 2)->nullable();
            $table->decimal('placement_fee', 15, 2)->nullable();
            $table->decimal('other_expenses', 15, 2)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('travel_assistance_details');
    }
};
