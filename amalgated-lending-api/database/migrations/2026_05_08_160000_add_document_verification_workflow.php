<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_documents', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_documents', 'verification_status')) {
                $table->string('verification_status', 40)->default('pending')->after('original_name')->index();
            }
            if (! Schema::hasColumn('loan_documents', 'verified_by')) {
                $table->foreignId('verified_by')
                    ->nullable()
                    ->after('verification_status')
                    ->constrained('users')
                    ->nullOnDelete();
            }
            if (! Schema::hasColumn('loan_documents', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
            if (! Schema::hasColumn('loan_documents', 'review_notes')) {
                $table->text('review_notes')->nullable()->after('verified_at');
            }
        });

        Schema::table('loans', function (Blueprint $table) {
            if (! Schema::hasColumn('loans', 'document_reviews')) {
                $table->json('document_reviews')->nullable()->after('kyc_documents');
            }
        });
    }

    public function down(): void
    {
        Schema::table('loans', function (Blueprint $table) {
            if (Schema::hasColumn('loans', 'document_reviews')) {
                $table->dropColumn('document_reviews');
            }
        });

        Schema::table('loan_documents', function (Blueprint $table) {
            if (Schema::hasColumn('loan_documents', 'verified_by')) {
                try {
                    $table->dropForeign(['verified_by']);
                } catch (Throwable) {
                    // FK name varies by driver / partial installs
                }
            }
            foreach (['review_notes', 'verified_at', 'verified_by', 'verification_status'] as $col) {
                if (Schema::hasColumn('loan_documents', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
