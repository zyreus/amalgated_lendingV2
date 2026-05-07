<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('borrower_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade')->unique();

            $table->string('first_name', 128);
            $table->string('last_name', 128);
            $table->string('phone_number', 32)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('address', 500)->nullable();
            $table->decimal('monthly_income', 14, 2)->nullable();
            $table->string('employment_status', 64)->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('borrower_profiles');
    }
};

