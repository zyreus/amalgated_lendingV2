<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('leads')) {
            return;
        }

        Schema::table('leads', function (Blueprint $table) {
            if (! Schema::hasColumn('leads', 'source_page')) {
                $table->string('source_page', 500)->nullable()->after('source')->index();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('leads') || ! Schema::hasColumn('leads', 'source_page')) {
            return;
        }

        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn('source_page');
        });
    }
};
