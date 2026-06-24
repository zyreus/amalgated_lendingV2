<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('co_makers', function (Blueprint $table) {
            if (! Schema::hasColumn('co_makers', 'first_name')) {
                $table->string('first_name', 120)->nullable()->after('loan_id');
            }
            if (! Schema::hasColumn('co_makers', 'middle_name')) {
                $table->string('middle_name', 120)->nullable()->after('first_name');
            }
            if (! Schema::hasColumn('co_makers', 'last_name')) {
                $table->string('last_name', 120)->nullable()->after('middle_name');
            }
            if (! Schema::hasColumn('co_makers', 'suffix')) {
                $table->string('suffix', 32)->nullable()->after('last_name');
            }
            if (! Schema::hasColumn('co_makers', 'date_of_birth')) {
                $table->date('date_of_birth')->nullable()->after('suffix');
            }
            if (! Schema::hasColumn('co_makers', 'civil_status')) {
                $table->string('civil_status', 40)->nullable()->after('date_of_birth');
            }
            if (! Schema::hasColumn('co_makers', 'complete_address')) {
                $table->text('complete_address')->nullable()->after('address');
            }
            if (! Schema::hasColumn('co_makers', 'province')) {
                $table->string('province', 120)->nullable()->after('complete_address');
            }
            if (! Schema::hasColumn('co_makers', 'city_municipality')) {
                $table->string('city_municipality', 120)->nullable()->after('province');
            }
            if (! Schema::hasColumn('co_makers', 'barangay')) {
                $table->string('barangay', 120)->nullable()->after('city_municipality');
            }
            if (! Schema::hasColumn('co_makers', 'postal_code')) {
                $table->string('postal_code', 16)->nullable()->after('barangay');
            }
        });

        // Backfill structured name fields from legacy full_name where empty.
        DB::table('co_makers')
            ->whereNull('first_name')
            ->whereNotNull('full_name')
            ->orderBy('id')
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    $name = trim((string) $row->full_name);
                    if ($name === '') {
                        continue;
                    }
                    DB::table('co_makers')->where('id', $row->id)->update([
                        'first_name' => $name,
                        'last_name' => $name,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('co_makers', function (Blueprint $table) {
            foreach ([
                'postal_code', 'barangay', 'city_municipality', 'province', 'complete_address',
                'civil_status', 'date_of_birth', 'suffix', 'last_name', 'middle_name', 'first_name',
            ] as $col) {
                if (Schema::hasColumn('co_makers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
