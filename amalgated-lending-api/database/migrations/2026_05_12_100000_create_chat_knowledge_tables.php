<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_knowledge_documents', function (Blueprint $table) {
            $table->id();
            $table->string('source_key', 191)->unique();
            $table->string('source_type', 64)->index();
            $table->string('title', 500)->nullable();
            $table->string('source_url', 1024)->nullable();
            $table->string('checksum', 64)->nullable()->index();
            $table->longText('content_raw')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('chat_knowledge_chunks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('chat_knowledge_document_id')
                ->constrained('chat_knowledge_documents')
                ->cascadeOnDelete();
            $table->unsignedSmallInteger('chunk_index')->default(0);
            $table->text('body');
            $table->longText('embedding_json')->nullable();
            $table->timestamps();

            $table->index(['chat_knowledge_document_id', 'chunk_index'], 'ck_chunks_doc_idx');
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            Schema::table('chat_knowledge_chunks', function (Blueprint $table) {
                $table->fullText('body');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_knowledge_chunks');
        Schema::dropIfExists('chat_knowledge_documents');
    }
};
