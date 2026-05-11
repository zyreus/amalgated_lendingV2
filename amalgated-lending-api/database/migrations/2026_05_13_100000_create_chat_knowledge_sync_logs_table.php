<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Audit trail for `php artisan chat:knowledge-sync` / admin “Re-sync” runs.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_knowledge_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->boolean('ok')->default(true);
            $table->json('stats')->nullable();
            $table->text('error_message')->nullable();
            $table->unsignedInteger('duration_ms')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_knowledge_sync_logs');
    }
};
