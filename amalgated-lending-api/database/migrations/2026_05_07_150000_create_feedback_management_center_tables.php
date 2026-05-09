<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            Schema::create('feedback_tickets', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('borrower_id')->nullable()->index();
                $table->foreignId('support_chat_feedback_id')->nullable()->unique();
                $table->foreignId('support_conversation_id')->nullable()->index();

                $table->string('category', 64)->default('General Feedback')->index();
                $table->string('priority', 24)->default('Medium')->index();
                $table->string('status', 32)->default('New')->index();

                $table->foreignId('assigned_staff_id')->nullable()->index();
                $table->string('department', 64)->nullable()->index();

                $table->string('subject', 191)->nullable();
                $table->text('message');
                $table->unsignedTinyInteger('rating')->nullable()->index();
                $table->decimal('sentiment_score', 5, 2)->nullable()->index();

                $table->string('contact_number', 32)->nullable();
                $table->string('email', 191)->nullable()->index();
                $table->string('location', 191)->nullable()->index();

                $table->boolean('is_sensitive')->default(false)->index();
                $table->boolean('is_vip')->default(false)->index();
                $table->string('risk_level', 24)->nullable()->index();
                $table->string('payment_status', 32)->nullable()->index();

                $table->timestamp('first_response_at')->nullable();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamp('closed_at')->nullable();
                $table->timestamp('follow_up_at')->nullable()->index();
                $table->timestamp('resolution_deadline_at')->nullable()->index();
                $table->unsignedInteger('sla_minutes')->nullable();
                $table->unsignedInteger('escalation_count')->default(0);

                $table->json('tags')->nullable();
                $table->json('checklist')->nullable();
                $table->timestamps();

                $table->foreign('borrower_id', 'fk_feedback_tickets_borrower_id')
                    ->references('id')->on('users')->nullOnDelete();
                $table->foreign('support_chat_feedback_id', 'fk_feedback_tickets_support_chat_feedback_id')
                    ->references('id')->on('support_chat_feedback')->nullOnDelete();
                $table->foreign('support_conversation_id', 'fk_feedback_tickets_support_conversation_id')
                    ->references('id')->on('support_conversations')->nullOnDelete();
                $table->foreign('assigned_staff_id', 'fk_feedback_tickets_assigned_staff_id')
                    ->references('id')->on('users')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('feedback_replies')) {
            Schema::create('feedback_replies', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('feedback_id');
                /** customer | staff | system */
                $table->string('sender_type', 24)->index();
                $table->foreignId('sender_id')->nullable()->index();
                $table->text('message');
                $table->string('attachment')->nullable();
                $table->timestamps();

                $table->foreign('feedback_id', 'fk_feedback_replies_feedback_id')
                    ->references('id')->on('feedback_tickets')->cascadeOnDelete();
                $table->foreign('sender_id', 'fk_feedback_replies_sender_id')
                    ->references('id')->on('users')->nullOnDelete();
            });
        }

        if (! Schema::hasTable('feedback_analytics')) {
            Schema::create('feedback_analytics', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('feedback_id')->unique();
                $table->unsignedInteger('resolution_time')->nullable(); // minutes
                $table->unsignedTinyInteger('csat_score')->nullable(); // 1..5
                $table->smallInteger('nps_score')->nullable(); // -100..100
                $table->unsignedInteger('escalation_count')->default(0);
                $table->unsignedInteger('first_response_time')->nullable(); // minutes
                $table->timestamps();

                $table->foreign('feedback_id', 'fk_feedback_analytics_feedback_id')
                    ->references('id')->on('feedback_tickets')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('feedback_audit_logs')) {
            Schema::create('feedback_audit_logs', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('feedback_id')->index();
                $table->foreignId('actor_id')->nullable()->index();
                $table->string('action', 64)->index();
                $table->json('meta')->nullable();
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('feedback_id', 'fk_feedback_audit_logs_feedback_id')
                    ->references('id')->on('feedback_tickets')->cascadeOnDelete();
                $table->foreign('actor_id', 'fk_feedback_audit_logs_actor_id')
                    ->references('id')->on('users')->nullOnDelete();
            });
        }

        // Backfill tickets from legacy support_chat_feedback for admin inbox continuity.
        if (Schema::hasTable('support_chat_feedback') && Schema::hasTable('feedback_tickets')) {
            $existingSupportIds = DB::table('feedback_tickets')
                ->whereNotNull('support_chat_feedback_id')
                ->pluck('support_chat_feedback_id')
                ->all();

            DB::table('support_chat_feedback')
                ->select(['id', 'support_conversation_id', 'session_id', 'rating', 'name', 'email', 'subject', 'comment', 'status', 'created_at', 'updated_at'])
                ->when(count($existingSupportIds) > 0, fn ($q) => $q->whereNotIn('id', $existingSupportIds))
                ->orderBy('id')
                ->chunkById(250, function ($rows): void {
                    $now = now();
                    $insert = [];
                    foreach ($rows as $row) {
                        $insert[] = [
                            'borrower_id' => null,
                            'support_chat_feedback_id' => $row->id,
                            'support_conversation_id' => $row->support_conversation_id,
                            'category' => 'General Feedback',
                            'priority' => 'Medium',
                            'status' => $this->mapLegacyStatus((string) ($row->status ?? 'new')),
                            'assigned_staff_id' => null,
                            'department' => null,
                            'subject' => $row->subject ?: null,
                            'message' => (string) $row->comment,
                            'rating' => $row->rating ?? null,
                            'sentiment_score' => null,
                            'contact_number' => null,
                            'email' => $row->email ?: null,
                            'location' => null,
                            'is_sensitive' => false,
                            'is_vip' => false,
                            'risk_level' => null,
                            'payment_status' => null,
                            'first_response_at' => null,
                            'resolved_at' => null,
                            'closed_at' => null,
                            'follow_up_at' => null,
                            'resolution_deadline_at' => null,
                            'sla_minutes' => null,
                            'escalation_count' => 0,
                            'tags' => null,
                            'checklist' => null,
                            'created_at' => $row->created_at ?: $now,
                            'updated_at' => $row->updated_at ?: $now,
                        ];
                    }
                    if (! empty($insert)) {
                        DB::table('feedback_tickets')->insert($insert);
                    }
                });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_audit_logs');
        Schema::dropIfExists('feedback_analytics');
        Schema::dropIfExists('feedback_replies');
        Schema::dropIfExists('feedback_tickets');
    }

    private function mapLegacyStatus(string $legacy): string
    {
        $v = strtolower(trim($legacy));

        return match ($v) {
            'new' => 'New',
            'read' => 'Read',
            'replied' => 'Replied',
            default => 'New',
        };
    }
};
