<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Some environments have migration history rows for liveness/face verification,
 * but the physical tables are missing (manual DB restore/drift). This repair
 * migration is idempotent and recreates the required tables/columns/indexes.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('liveness_verifications')) {
            Schema::create('liveness_verifications', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
                $table->string('face_id', 512)->nullable();
                $table->decimal('confidence', 10, 6)->nullable()->comment('0–1 FaceIO confidence');
                $table->json('images')->nullable()->comment('Stored relative paths for action frames');
                $table->string('final_image')->nullable()->comment('Relative path for final selfie');
                $table->decimal('similarity_score', 6, 2)->nullable();
                $table->string('status', 16)->index();
                $table->string('failure_reason')->nullable();
                $table->timestamps();

                $table->index(['borrower_id', 'created_at']);
            });
        } else {
            Schema::table('liveness_verifications', function (Blueprint $table): void {
                if (! Schema::hasColumn('liveness_verifications', 'face_id')) {
                    $table->string('face_id', 512)->nullable()->after('borrower_id');
                }
                if (! Schema::hasColumn('liveness_verifications', 'confidence')) {
                    $table->decimal('confidence', 10, 6)->nullable()->after('face_id')->comment('0–1 FaceIO confidence');
                }
            });
        }

        if (! Schema::hasTable('face_verifications')) {
            Schema::create('face_verifications', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
                $table->string('captured_image')->comment('Relative path under storage/app');
                $table->decimal('similarity_score', 6, 2)->nullable();
                $table->string('status', 16)->index();
                $table->timestamps();

                $table->index(['borrower_id', 'created_at']);
            });
        }
    }

    public function down(): void
    {
        // Repair migration is intentionally non-destructive on rollback.
    }
};
