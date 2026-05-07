<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Unified support / visitor chat warehouse (CRM sync + Laravel analytics).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('support_conversations')) {
            Schema::create('support_conversations', function (Blueprint $table): void {
                $table->id();
                $table->string('session_id', 191)->unique();
                $table->string('visitor_id')->nullable()->index();
                $table->string('guest_name')->nullable();
                $table->string('guest_email')->nullable();
                /** Mirrors Node: ai | human */
                $table->string('mode', 24)->default('ai');
                /** open | in_progress | resolved | escalated | archived */
                $table->string('status', 32)->default('open');
                $table->boolean('needs_human')->default(false);
                /** Track who last replied for CRM filters */
                $table->string('last_responder_type', 24)->nullable();
                $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
                $table->unsignedSmallInteger('unread_admin')->default(0);
                $table->unsignedTinyInteger('customer_rating')->nullable();
                $table->text('rating_comment')->nullable();
                $table->timestamp('rated_at')->nullable();
                $table->timestamp('escalated_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('support_ai_logs')) {
            Schema::create('support_ai_logs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('support_conversation_id')->constrained('support_conversations')->cascadeOnDelete();
                $table->unsignedInteger('latency_ms')->nullable();
                $table->string('model', 96)->nullable();
                $table->unsignedSmallInteger('response_chars')->nullable();
                $table->text('snippet')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('support_chat_feedback')) {
            Schema::create('support_chat_feedback', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('support_conversation_id')->nullable()->constrained('support_conversations')->nullOnDelete();
                $table->string('session_id', 191)->index();
                $table->unsignedTinyInteger('rating');
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->text('comment');
                $table->boolean('is_from_sync')->default(false);
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('support_assignments')) {
            Schema::create('support_assignments', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('support_conversation_id')->constrained('support_conversations')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('assigned_at')->useCurrent();
                $table->timestamps();
            });
        }

        Schema::table('chat_messages', function (Blueprint $table): void {
            if (! Schema::hasColumn('chat_messages', 'support_conversation_id')) {
                $table->foreignId('support_conversation_id')->nullable()->after('id')->constrained('support_conversations')->cascadeOnDelete();
            }
            if (! Schema::hasColumn('chat_messages', 'sender_type')) {
                /** customer | ai | admin | system */
                $table->string('sender_type', 24)->nullable()->after('visitor_id')->index();
            }
            if (! Schema::hasColumn('chat_messages', 'sender_name')) {
                $table->string('sender_name')->nullable()->after('sender_type');
            }
            if (! Schema::hasColumn('chat_messages', 'rating')) {
                $table->unsignedTinyInteger('rating')->nullable()->after('sender_name');
            }
            if (! Schema::hasColumn('chat_messages', 'routing_status')) {
                $table->string('routing_status', 48)->nullable()->after('rating');
            }
            if (! Schema::hasColumn('chat_messages', 'is_feedback')) {
                $table->boolean('is_feedback')->default(false)->after('routing_status')->index();
            }
            if (! Schema::hasColumn('chat_messages', 'dedupe_key')) {
                $table->uuid('dedupe_key')->nullable()->unique()->after('is_feedback');
            }
            if (! Schema::hasColumn('chat_messages', 'meta')) {
                $table->json('meta')->nullable()->after('dedupe_key');
            }
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table): void {
            foreach ([
                'support_conversation_id',
                'sender_type',
                'sender_name',
                'rating',
                'routing_status',
                'is_feedback',
                'dedupe_key',
                'meta',
            ] as $col) {
                if (Schema::hasColumn('chat_messages', $col)) {
                    if ($col === 'support_conversation_id') {
                        $table->dropForeign(['support_conversation_id']);
                    }
                    if ($col === 'dedupe_key') {
                        $table->dropUnique(['dedupe_key']);
                    }
                    $table->dropColumn($col);
                }
            }
        });
        Schema::dropIfExists('support_assignments');
        Schema::dropIfExists('support_chat_feedback');
        Schema::dropIfExists('support_ai_logs');
        Schema::dropIfExists('support_conversations');
    }
};
