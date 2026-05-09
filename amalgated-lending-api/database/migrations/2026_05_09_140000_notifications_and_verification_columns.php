<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'email_verified_at')) {
            Schema::table('users', function (Blueprint $table) {
                $table->timestamp('email_verified_at')->nullable()->index();
            });
        }

        if (Schema::hasTable('payments') && ! Schema::hasColumn('payments', 'official_receipt_number')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->string('official_receipt_number', 64)->nullable()->unique();
            });
        }

        Schema::create('email_verification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('event', 32)->index(); // sent, resent, verified, failed
            $table->string('ip_address', 45)->nullable();
            $table->string('detail', 512)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verification_logs');

        if (Schema::hasTable('payments') && Schema::hasColumn('payments', 'official_receipt_number')) {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropUnique(['official_receipt_number']);
                $table->dropColumn('official_receipt_number');
            });
        }

    }
};
