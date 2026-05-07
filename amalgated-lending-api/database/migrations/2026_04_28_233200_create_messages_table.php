<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table): void {
            $table->id();
            $table->uuid('public_id')->unique();
            $table->foreignId('chat_id')->constrained('chats')->cascadeOnDelete();
            $table->string('sender_type', 24);
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('role', 24)->default('user');
            $table->longText('content');
            $table->boolean('is_ai_generated')->default(false);
            $table->string('provider', 32)->nullable();
            $table->string('model', 120)->nullable();
            $table->foreignId('parent_message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->string('stream_request_key', 100)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['chat_id', 'created_at'], 'messages_chat_created_idx');
            $table->index(['chat_id', 'id'], 'messages_chat_seek_idx');
            $table->index(['sender_type', 'sender_user_id'], 'messages_sender_idx');
            $table->index(['stream_request_key'], 'messages_stream_key_idx');
        });

        Schema::table('chats', function (Blueprint $table): void {
            $table->foreign('last_message_id')->references('id')->on('messages')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('chats', function (Blueprint $table): void {
            $table->dropForeign(['last_message_id']);
        });

        Schema::dropIfExists('messages');
    }
};
