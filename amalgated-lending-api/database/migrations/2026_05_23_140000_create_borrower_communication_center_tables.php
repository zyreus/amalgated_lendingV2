<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('portal_conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->string('subject')->nullable();
            $table->string('status', 32)->default('active')->index();
            $table->boolean('is_pinned')->default(false)->index();
            $table->timestamp('archived_at')->nullable()->index();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamp('borrower_last_seen_at')->nullable();
            $table->timestamp('admin_last_seen_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['borrower_id', 'status']);
        });

        Schema::create('portal_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('portal_conversation_id')->constrained('portal_conversations')->cascadeOnDelete();
            $table->enum('sender_type', ['borrower', 'admin', 'system'])->index();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body')->nullable();
            $table->json('attachments')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('support_tickets', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 32)->unique();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('subject');
            $table->string('category', 64)->default('Other')->index();
            $table->string('priority', 16)->default('low')->index();
            $table->string('status', 32)->default('open')->index();
            $table->timestamp('last_reply_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamp('sla_due_at')->nullable()->index();
            $table->unsignedTinyInteger('satisfaction_rating')->nullable();
            $table->text('satisfaction_comment')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['borrower_id', 'status']);
            $table->index(['assigned_to', 'status']);
        });

        Schema::create('support_ticket_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->enum('sender_type', ['borrower', 'admin', 'system'])->index();
            $table->foreignId('sender_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('body')->nullable();
            $table->boolean('is_internal')->default(false)->index();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('seen_at')->nullable();
            $table->timestamps();
        });

        Schema::create('support_ticket_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('support_ticket_message_id')->nullable()->constrained('support_ticket_messages')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('disk')->default('public');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();
        });

        Schema::create('support_ticket_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('support_ticket_id')->constrained('support_tickets')->cascadeOnDelete();
            $table->foreignId('admin_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('note');
            $table->json('activity')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_ticket_notes');
        Schema::dropIfExists('support_ticket_attachments');
        Schema::dropIfExists('support_ticket_messages');
        Schema::dropIfExists('support_tickets');
        Schema::dropIfExists('portal_messages');
        Schema::dropIfExists('portal_conversations');
    }
};
