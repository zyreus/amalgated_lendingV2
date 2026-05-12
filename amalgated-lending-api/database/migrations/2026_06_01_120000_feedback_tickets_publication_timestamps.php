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
            if (! Schema::hasColumn('feedback_tickets', 'publication_approved_at')) {
                $table->timestamp('publication_approved_at')->nullable()->after('publication_status')->index();
            }
            if (! Schema::hasColumn('feedback_tickets', 'rejected_at')) {
                $table->timestamp('rejected_at')->nullable()->after('publication_approved_at')->index();
            }
        });

        if (Schema::hasColumn('feedback_tickets', 'publication_approved_at')) {
            DB::table('feedback_tickets')
                ->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", ['approved'])
                ->whereNull('publication_approved_at')
                ->update(['publication_approved_at' => DB::raw('COALESCE(updated_at, created_at)')]);
        }

        if (Schema::hasColumn('feedback_tickets', 'rejected_at')) {
            DB::table('feedback_tickets')
                ->whereRaw("LOWER(TRIM(COALESCE(publication_status, ''))) = ?", ['rejected'])
                ->whereNull('rejected_at')
                ->update(['rejected_at' => DB::raw('COALESCE(updated_at, created_at)')]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        Schema::table('feedback_tickets', function (Blueprint $table) {
            if (Schema::hasColumn('feedback_tickets', 'rejected_at')) {
                $table->dropColumn('rejected_at');
            }
            if (Schema::hasColumn('feedback_tickets', 'publication_approved_at')) {
                $table->dropColumn('publication_approved_at');
            }
        });
    }
};
