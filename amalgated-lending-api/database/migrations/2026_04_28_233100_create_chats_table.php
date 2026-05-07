<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chats', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('contact_id')->constrained('contacts')->cascadeOnDelete();
            $table->foreignId('owner_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('subject')->nullable();
            $table->string('channel', 40)->default('web');
            $table->string('status', 32)->default('open');
            $table->unsignedBigInteger('last_message_id')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->unsignedInteger('customer_unread_count')->default(0);
            $table->unsignedInteger('agent_unread_count')->default(0);
            $table->text('ai_summary')->nullable();
            $table->timestamp('ai_summary_generated_at')->nullable();
            $table->unsignedSmallInteger('context_window_size')->default(20);
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['contact_id', 'last_message_at'], 'chats_contact_last_message_idx');
            $table->index(['owner_user_id', 'status', 'last_message_at'], 'chats_owner_status_last_message_idx');
            $table->index(['owner_user_id', 'updated_at'], 'chats_owner_updated_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chats');
    }
};
