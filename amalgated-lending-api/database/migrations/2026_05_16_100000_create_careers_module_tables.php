<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('careers_departments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('careers_branches', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->nullable();
            $table->string('address')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('careers_jobs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('department_id')->nullable()->constrained('careers_departments')->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('careers_branches')->nullOnDelete();
            $table->string('title');
            $table->string('slug')->unique();
            $table->string('employment_type')->default('full_time');
            $table->decimal('salary_min', 12, 2)->nullable();
            $table->decimal('salary_max', 12, 2)->nullable();
            $table->string('salary_currency', 8)->default('PHP');
            $table->longText('qualifications')->nullable();
            $table->longText('responsibilities')->nullable();
            $table->longText('requirements')->nullable();
            $table->longText('benefits')->nullable();
            $table->longText('application_instructions')->nullable();
            $table->string('status', 32)->default('draft')->index();
            $table->date('application_deadline')->nullable()->index();
            $table->timestamp('published_at')->nullable()->index();
            $table->string('seo_title')->nullable();
            $table->string('seo_description', 512)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['status', 'application_deadline']);
        });

        Schema::create('careers_applicants', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('phone', 64)->nullable();
            $table->string('first_name');
            $table->string('last_name');
            $table->string('portfolio_url', 512)->nullable();
            $table->timestamps();
        });

        Schema::create('careers_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('careers_job_id')->constrained('careers_jobs')->restrictOnDelete();
            $table->foreignId('careers_applicant_id')->constrained('careers_applicants')->cascadeOnDelete();
            $table->longText('cover_letter')->nullable();
            $table->string('resume_disk', 32)->default('local');
            $table->string('resume_path', 512)->nullable();
            $table->string('resume_original_name', 255)->nullable();
            $table->string('status', 40)->default('new')->index();
            $table->timestamp('applied_at')->useCurrent();
            $table->foreignId('recruiter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->longText('internal_notes')->nullable();
            $table->longText('interview_feedback')->nullable();
            $table->boolean('send_automated_emails')->default(true);
            $table->timestamps();
            $table->unique(['careers_job_id', 'careers_applicant_id']);
            $table->index(['careers_job_id', 'status']);
            $table->index(['applied_at']);
        });

        Schema::create('careers_interviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('careers_application_id')->constrained('careers_applications')->cascadeOnDelete();
            $table->timestamp('scheduled_at');
            $table->string('timezone', 64)->default('Asia/Manila');
            $table->string('location', 512)->nullable();
            $table->string('meeting_link', 512)->nullable();
            $table->string('interviewer_name', 255)->nullable();
            $table->longText('notes')->nullable();
            $table->string('outcome', 32)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['careers_application_id', 'scheduled_at']);
        });

        Schema::create('careers_email_logs', function (Blueprint $table) {
            $table->id();
            $table->nullableMorphs('related');
            $table->string('to_email');
            $table->string('subject');
            $table->string('template_key', 64)->index();
            $table->string('status', 24)->default('sent')->index();
            $table->text('error_message')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('careers_email_logs');
        Schema::dropIfExists('careers_interviews');
        Schema::dropIfExists('careers_applications');
        Schema::dropIfExists('careers_applicants');
        Schema::dropIfExists('careers_jobs');
        Schema::dropIfExists('careers_branches');
        Schema::dropIfExists('careers_departments');
    }
};
