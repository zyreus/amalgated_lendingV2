<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_statements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('borrower_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->string('loan_account_no', 64);
            $table->date('period');
            $table->decimal('loan_amount', 14, 2)->default(0);
            $table->decimal('remaining_balance', 14, 2)->default(0);
            $table->decimal('monthly_due', 14, 2)->default(0);
            $table->date('due_date')->nullable();
            $table->timestamps();

            $table->index(['borrower_id', 'period']);
            $table->unique(['borrower_id', 'loan_account_no', 'period'], 'loan_statements_borrower_account_period_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_statements');
    }
};
