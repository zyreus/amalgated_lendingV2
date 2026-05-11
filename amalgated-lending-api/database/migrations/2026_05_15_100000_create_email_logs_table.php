<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->string('dedupe_key', 191)->unique();
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->string('notification_type', 64)->index();
            $table->string('mailable_class', 255);
            $table->string('recipient_email', 255);
            $table->string('recipient_name', 255)->nullable();
            $table->string('subject', 512)->nullable();
            $table->string('status', 32)->index();
            $table->string('transport_detail', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamps();

            $table->index(['loan_id', 'notification_type', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_logs');
    }
};
