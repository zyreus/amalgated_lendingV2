<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_logs') && ! Schema::hasColumn('email_logs', 'payment_id')) {
            Schema::table('email_logs', function (Blueprint $table) {
                $table->foreignId('payment_id')->nullable()->after('loan_id')->constrained('payments')->nullOnDelete();
                $table->index(['payment_id', 'notification_type', 'id']);
            });
        }

        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table) {
                if (! Schema::hasColumn('payments', 'confirmed_by')) {
                    $table->foreignId('confirmed_by')->nullable()->after('paid_at')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('payments', 'confirmation_date')) {
                    $table->timestamp('confirmation_date')->nullable()->after('confirmed_by');
                }
                if (! Schema::hasColumn('payments', 'invoice_pdf_path')) {
                    $table->string('invoice_pdf_path', 512)->nullable()->after('receipt_path');
                }
            });
        }

        if (! Schema::hasTable('payment_receipts')) {
            Schema::create('payment_receipts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
                $table->foreignId('loan_id')->constrained('loans')->cascadeOnDelete();
                $table->string('receipt_number', 64)->index();
                $table->string('pdf_path', 512);
                $table->foreignId('generated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->index(['payment_id', 'id']);
                $table->index(['loan_id', 'id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_receipts');

        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table) {
                foreach (['invoice_pdf_path', 'confirmation_date', 'confirmed_by'] as $col) {
                    if (Schema::hasColumn('payments', $col)) {
                        if ($col === 'confirmed_by') {
                            $table->dropForeign(['confirmed_by']);
                        }
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('email_logs') && Schema::hasColumn('email_logs', 'payment_id')) {
            Schema::table('email_logs', function (Blueprint $table) {
                $table->dropForeign(['payment_id']);
                $table->dropColumn('payment_id');
            });
        }
    }
};
