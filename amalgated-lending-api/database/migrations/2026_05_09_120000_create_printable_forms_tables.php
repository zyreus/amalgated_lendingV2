<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('printable_forms', function (Blueprint $table) {
            $table->id();
            $table->string('form_key', 64)->unique();
            $table->string('title');
            $table->string('category', 64)->default('lending');
            $table->string('branch', 128)->nullable()->index();
            $table->text('description')->nullable();
            /** Relative path on master_templates disk when uploaded; null = built-in Blade view */
            $table->string('template_file', 512)->nullable();
            $table->string('pdf_version', 32)->default('1.0.0');
            $table->string('status', 24)->default('active')->index();
            $table->boolean('watermark_enabled')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('printable_form_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('printable_form_id')->constrained('printable_forms')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_type', 24)->default('borrower'); // admin, borrower, system
            $table->string('action', 32)->index(); // generated, downloaded, previewed
            $table->string('storage_path', 512)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('downloaded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('printable_form_logs');
        Schema::dropIfExists('printable_forms');
    }
};
