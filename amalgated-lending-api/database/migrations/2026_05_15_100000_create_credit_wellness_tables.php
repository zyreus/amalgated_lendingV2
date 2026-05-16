<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('borrower_credit_wellness')) {
            Schema::create('borrower_credit_wellness', function (Blueprint $table) {
                $table->id();
                $table->foreignId('borrower_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->unsignedSmallInteger('wellness_score')->default(0);
                $table->string('score_category', 32)->default('fair');
                $table->decimal('repayment_rate', 5, 2)->default(0);
                $table->unsignedInteger('delayed_payment_count')->default(0);
                $table->unsignedInteger('missed_payment_count')->default(0);
                $table->decimal('total_penalties', 12, 2)->default(0);
                $table->unsignedSmallInteger('active_loan_count')->default(0);
                $table->string('default_risk_level', 16)->default('low');
                $table->unsignedSmallInteger('payment_streak')->default(0);
                $table->decimal('delayed_payment_rate', 5, 2)->default(0);
                $table->unsignedSmallInteger('avg_delay_days')->default(0);
                $table->unsignedSmallInteger('longest_delay_days')->default(0);
                $table->decimal('current_overdue_amount', 12, 2)->default(0);
                $table->decimal('total_outstanding_balance', 12, 2)->default(0);
                $table->string('improvement_trend', 16)->default('stable');
                $table->json('risk_flags')->nullable();
                $table->json('recommendations')->nullable();
                $table->json('delay_metrics')->nullable();
                $table->json('eligibility_impact')->nullable();
                $table->timestamps();

                $table->index('score_category');
                $table->index('default_risk_level');
                $table->index('wellness_score');
            });
        }

        if (! Schema::hasTable('loan_health_metrics')) {
            Schema::create('loan_health_metrics', function (Blueprint $table) {
                $table->id();
                $table->foreignId('loan_id')->unique()->constrained('loans')->cascadeOnDelete();
                $table->string('health_status', 32)->default('healthy');
                $table->unsignedSmallInteger('overdue_days')->default(0);
                $table->unsignedInteger('missed_payments')->default(0);
                $table->unsignedInteger('delayed_payments')->default(0);
                $table->decimal('penalties', 12, 2)->default(0);
                $table->decimal('payment_consistency', 5, 2)->default(100);
                $table->unsignedSmallInteger('restructuring_count')->default(0);
                $table->decimal('current_overdue_amount', 12, 2)->default(0);
                $table->timestamps();

                $table->index('health_status');
            });
        }

        if (! Schema::hasTable('wellness_history')) {
            Schema::create('wellness_history', function (Blueprint $table) {
                $table->id();
                $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
                $table->unsignedSmallInteger('score');
                $table->string('score_category', 32)->nullable();
                $table->json('snapshot')->nullable();
                $table->timestamp('recorded_at');

                $table->index(['borrower_id', 'recorded_at']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('wellness_history');
        Schema::dropIfExists('loan_health_metrics');
        Schema::dropIfExists('borrower_credit_wellness');
    }
};
