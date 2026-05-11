<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        Schema::table('feedback_tickets', function (Blueprint $table): void {
            if (! Schema::hasColumn('feedback_tickets', 'website_visible')) {
                $table->boolean('website_visible')->default(false)->after('checklist');
            }
            if (! Schema::hasColumn('feedback_tickets', 'public_author_label')) {
                $table->string('public_author_label', 120)->nullable()->after('website_visible');
            }
        });

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->index(['website_visible', 'rating', 'created_at'], 'feedback_tickets_public_rating_created_idx');
            });
        } catch (\Throwable) {
            /* index may already exist when re-running */
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->dropIndex('feedback_tickets_public_rating_created_idx');
            });
        } catch (\Throwable) {
            /* ignore */
        }

        Schema::table('feedback_tickets', function (Blueprint $table): void {
            if (Schema::hasColumn('feedback_tickets', 'public_author_label')) {
                $table->dropColumn('public_author_label');
            }
            if (Schema::hasColumn('feedback_tickets', 'website_visible')) {
                $table->dropColumn('website_visible');
            }
        });
    }
};
