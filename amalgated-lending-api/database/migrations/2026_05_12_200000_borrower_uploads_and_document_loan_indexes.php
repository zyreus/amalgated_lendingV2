<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('document_loan_applications')) {
            try {
                Schema::table('document_loan_applications', function (Blueprint $table) {
                    $table->index(['user_id', 'loan_product_id', 'submitted_at'], 'dla_user_product_submitted_idx');
                });
            } catch (\Throwable $e) {
                if (! $this->isDuplicateKeyName($e)) {
                    throw $e;
                }
            }
        }

        if (Schema::hasTable('document_upload_histories')) {
            try {
                Schema::table('document_upload_histories', function (Blueprint $table) {
                    $table->index(['uploaded_document_id', 'version'], 'duh_uploaded_doc_version_idx');
                });
            } catch (\Throwable $e) {
                if (! $this->isDuplicateKeyName($e)) {
                    throw $e;
                }
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('document_loan_applications')) {
            try {
                Schema::table('document_loan_applications', function (Blueprint $table) {
                    $table->dropIndex('dla_user_product_submitted_idx');
                });
            } catch (\Throwable) {
                //
            }
        }
        if (Schema::hasTable('document_upload_histories')) {
            try {
                Schema::table('document_upload_histories', function (Blueprint $table) {
                    $table->dropIndex('duh_uploaded_doc_version_idx');
                });
            } catch (\Throwable) {
                //
            }
        }
    }

    private function isDuplicateKeyName(\Throwable $e): bool
    {
        $m = strtolower($e->getMessage());

        return str_contains($m, 'duplicate key') || str_contains($m, 'already exists');
    }
};
