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
            return;
        }

        Schema::table('feedback_tickets', function (Blueprint $table): void {
            if (! Schema::hasColumn('feedback_tickets', 'publication_status')) {
                $table->string('publication_status', 24)->default('pending')->after('status')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'featured')) {
                $table->boolean('featured')->default(false)->after('publication_status')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'source')) {
                $table->string('source', 32)->nullable()->default('chatbot')->after('featured')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'consent_public_display')) {
                $table->boolean('consent_public_display')->default(false)->after('source')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'verified_borrower')) {
                $table->boolean('verified_borrower')->default(false)->after('consent_public_display')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'loan_type')) {
                $table->string('loan_type', 96)->nullable()->after('verified_borrower')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'admin_notes')) {
                $table->text('admin_notes')->nullable()->after('loan_type');
            }
        });

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->index(['publication_status', 'featured', 'created_at'], 'feedback_tickets_pub_featured_created_idx');
            });
        } catch (\Throwable) {
            /* exists */
        }

        // Preserve rows already shown on the marketing site.
        if (Schema::hasColumn('feedback_tickets', 'website_visible')) {
            DB::table('feedback_tickets')
                ->where('website_visible', true)
                ->update([
                    'publication_status' => 'approved',
                    'consent_public_display' => true,
                    'featured' => true,
                ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->dropIndex('feedback_tickets_pub_featured_created_idx');
            });
        } catch (\Throwable) {
            /* ignore */
        }

        Schema::table('feedback_tickets', function (Blueprint $table): void {
            foreach (['admin_notes', 'loan_type', 'verified_borrower', 'consent_public_display', 'source', 'featured', 'publication_status'] as $col) {
                if (Schema::hasColumn('feedback_tickets', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
