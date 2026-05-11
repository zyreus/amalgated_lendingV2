<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Idempotent repair: some environments have `migrations` showing
 * `2026_05_11_220000_feedback_tickets_publication_pipeline` as ran while
 * `feedback_tickets` is missing columns (DB restore, partial deploy, etc.).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        if (! Schema::hasColumn('feedback_tickets', 'publication_status')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->string('publication_status', 24)->default('pending')->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'featured')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->boolean('featured')->default(false)->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'source')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->string('source', 32)->nullable()->default('chatbot')->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'consent_public_display')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->boolean('consent_public_display')->default(false)->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'verified_borrower')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->boolean('verified_borrower')->default(false)->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'loan_type')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->string('loan_type', 96)->nullable()->index();
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'admin_notes')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->text('admin_notes')->nullable();
            });
        }

        if (! Schema::hasColumn('feedback_tickets', 'website_visible')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->boolean('website_visible')->default(false);
            });
        }
        if (! Schema::hasColumn('feedback_tickets', 'public_author_label')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->string('public_author_label', 120)->nullable();
            });
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->index(['publication_status', 'featured', 'created_at'], 'feedback_tickets_pub_featured_created_idx');
            });
        } catch (\Throwable) {
            /* already exists */
        }

        if (Schema::hasColumn('feedback_tickets', 'website_visible')
            && Schema::hasColumn('feedback_tickets', 'publication_status')) {
            DB::table('feedback_tickets')
                ->where('website_visible', true)
                ->where(function ($q): void {
                    $q->whereNull('publication_status')
                        ->orWhere('publication_status', '')
                        ->orWhere('publication_status', 'pending');
                })
                ->update([
                    'publication_status' => 'approved',
                    'consent_public_display' => true,
                    'featured' => true,
                ]);
        }
    }

    public function down(): void
    {
        // Non-destructive repair migration: no down.
    }
};
