<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_usages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('chat_id')->nullable()->constrained('chats')->nullOnDelete();
            $table->foreignId('message_id')->nullable()->constrained('messages')->nullOnDelete();
            $table->string('provider', 32);
            $table->string('model', 120);
            $table->unsignedInteger('prompt_tokens')->default(0);
            $table->unsignedInteger('completion_tokens')->default(0);
            $table->unsignedInteger('total_tokens')->default(0);
            $table->unsignedInteger('latency_ms')->default(0);
            $table->string('status', 32)->default('pending');
            $table->string('request_key', 100)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['chat_id', 'created_at'], 'ai_usages_chat_created_idx');
            $table->index(['message_id'], 'ai_usages_message_idx');
            $table->index(['provider', 'model'], 'ai_usages_provider_model_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usages');
    }
};
