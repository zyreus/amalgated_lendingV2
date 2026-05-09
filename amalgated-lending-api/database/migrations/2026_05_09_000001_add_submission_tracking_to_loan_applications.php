<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('loan_applications', function (Blueprint $table) {
            if (! Schema::hasColumn('loan_applications', 'is_submitted')) {
                $table->boolean('is_submitted')->default(false)->after('submitted_at');
            }
            if (! Schema::hasColumn('loan_applications', 'draft_updated_at')) {
                $table->timestamp('draft_updated_at')->nullable()->after('is_submitted');
            }
        });

        if (Schema::hasColumn('loan_applications', 'is_submitted')) {
            DB::table('loan_applications')
                ->where(function ($q) {
                    $q->whereNotNull('submitted_at')
                        ->orWhereNotNull('loan_id');
                })
                ->update(['is_submitted' => true]);
        }
    }

    public function down(): void
    {
        Schema::table('loan_applications', function (Blueprint $table) {
            if (Schema::hasColumn('loan_applications', 'draft_updated_at')) {
                $table->dropColumn('draft_updated_at');
            }
            if (Schema::hasColumn('loan_applications', 'is_submitted')) {
                $table->dropColumn('is_submitted');
            }
        });
    }
};
