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

        Schema::table('feedback_tickets', function (Blueprint $table) {
            if (! Schema::hasColumn('feedback_tickets', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('rejected_at')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
            DB::table('feedback_tickets')
                ->where('status', 'Archived')
                ->whereNull('archived_at')
                ->update(['archived_at' => DB::raw('COALESCE(closed_at, updated_at, created_at)')]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        Schema::table('feedback_tickets', function (Blueprint $table) {
            if (Schema::hasColumn('feedback_tickets', 'deleted_at')) {
                $table->dropSoftDeletes();
            }
            if (Schema::hasColumn('feedback_tickets', 'archived_at')) {
                $table->dropColumn('archived_at');
            }
        });
    }
};
