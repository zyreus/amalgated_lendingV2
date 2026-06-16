<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'phone_verified_at')) {
                $table->timestamp('phone_verified_at')->nullable()->after('phone');
            }
            if (! Schema::hasColumn('users', 'borrower_status')) {
                $table->string('borrower_status', 32)->default('verified')->after('phone_verified_at')->index();
            }
            if (! Schema::hasColumn('users', 'otp_code')) {
                $table->string('otp_code')->nullable()->after('borrower_status');
            }
            if (! Schema::hasColumn('users', 'otp_expiration')) {
                $table->timestamp('otp_expiration')->nullable()->after('otp_code');
            }
            if (! Schema::hasColumn('users', 'verification_attempts')) {
                $table->unsignedSmallInteger('verification_attempts')->default(0)->after('otp_expiration');
            }
            if (! Schema::hasColumn('users', 'otp_resend_attempts')) {
                $table->unsignedSmallInteger('otp_resend_attempts')->default(0)->after('verification_attempts');
            }
            if (! Schema::hasColumn('users', 'otp_last_sent_at')) {
                $table->timestamp('otp_last_sent_at')->nullable()->after('otp_resend_attempts');
            }

            $table->index(['phone', 'phone_verified_at'], 'users_phone_verified_idx');
        });

        Schema::table('borrower_profiles', function (Blueprint $table): void {
            if (! Schema::hasColumn('borrower_profiles', 'middle_name')) {
                $table->string('middle_name', 128)->nullable()->after('first_name');
            }
            if (! Schema::hasColumn('borrower_profiles', 'gender')) {
                $table->string('gender', 32)->nullable()->after('date_of_birth');
            }
            if (! Schema::hasColumn('borrower_profiles', 'province')) {
                $table->string('province', 128)->nullable()->after('gender');
            }
            if (! Schema::hasColumn('borrower_profiles', 'city')) {
                $table->string('city', 128)->nullable()->after('province');
            }
            if (! Schema::hasColumn('borrower_profiles', 'barangay')) {
                $table->string('barangay', 128)->nullable()->after('city');
            }
            if (! Schema::hasColumn('borrower_profiles', 'complete_address')) {
                $table->string('complete_address', 500)->nullable()->after('barangay');
            }
        });
    }

    public function down(): void
    {
        Schema::table('borrower_profiles', function (Blueprint $table): void {
            foreach (['complete_address', 'barangay', 'city', 'province', 'gender', 'middle_name'] as $column) {
                if (Schema::hasColumn('borrower_profiles', $column)) {
                    $table->dropColumn($column);
                }
            }
        });

        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('users_phone_verified_idx');
            foreach ([
                'otp_last_sent_at',
                'otp_resend_attempts',
                'verification_attempts',
                'otp_expiration',
                'otp_code',
                'borrower_status',
                'phone_verified_at',
            ] as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
