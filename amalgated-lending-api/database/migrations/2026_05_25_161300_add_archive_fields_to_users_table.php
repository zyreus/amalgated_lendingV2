<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('is_archived')->default(false)->after('timezone')->index();
            $table->timestamp('archived_at')->nullable()->after('is_archived')->index();
            $table->string('archive_reason')->nullable()->after('archived_at')->index();
            $table->timestamp('deleted_at')->nullable()->after('archive_reason')->index();
            $table->foreignId('archived_by')->nullable()->after('deleted_at')->constrained('users')->nullOnDelete();
            $table->foreignId('restored_by')->nullable()->after('archived_by')->constrained('users')->nullOnDelete();
            $table->foreignId('deleted_by')->nullable()->after('restored_by')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('deleted_by');
            $table->dropConstrainedForeignId('restored_by');
            $table->dropConstrainedForeignId('archived_by');
            $table->dropColumn(['deleted_at', 'archive_reason', 'archived_at', 'is_archived']);
        });
    }
};
