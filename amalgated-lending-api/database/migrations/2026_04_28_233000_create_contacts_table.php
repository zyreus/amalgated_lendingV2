<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('company')->nullable();
            $table->string('job_title')->nullable();
            $table->string('source', 80)->nullable();
            $table->string('status', 32)->default('active');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->text('ai_summary')->nullable();
            $table->timestamp('ai_summary_generated_at')->nullable();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamps();

            $table->index(['owner_user_id', 'status', 'updated_at'], 'contacts_owner_status_updated_idx');
            $table->index(['owner_user_id', 'email'], 'contacts_owner_email_idx');
            $table->index(['owner_user_id', 'last_contacted_at'], 'contacts_owner_last_contacted_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
