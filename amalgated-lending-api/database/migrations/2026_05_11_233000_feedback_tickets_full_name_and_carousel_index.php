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

        if (! Schema::hasColumn('feedback_tickets', 'full_name')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->string('full_name', 191)->nullable()->after('email');
            });
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->index(
                    ['publication_status', 'featured', 'consent_public_display', 'updated_at'],
                    'feedback_tickets_carousel_list_idx'
                );
            });
        } catch (\Throwable) {
            /* exists */
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->dropIndex('feedback_tickets_carousel_list_idx');
            });
        } catch (\Throwable) {
            /* ignore */
        }

        if (Schema::hasColumn('feedback_tickets', 'full_name')) {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->dropColumn('full_name');
            });
        }
    }
};
