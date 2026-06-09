<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('payments')) {
            Schema::table('payments', function (Blueprint $table) {
                if (! Schema::hasColumn('payments', 'processed_by_user_id')) {
                    $table->foreignId('processed_by_user_id')->nullable()->after('recorded_by')->constrained('users')->nullOnDelete();
                }
                if (! Schema::hasColumn('payments', 'processed_by_name')) {
                    $table->string('processed_by_name', 191)->nullable()->after('processed_by_user_id');
                }
                if (! Schema::hasColumn('payments', 'receipt_pdf_path')) {
                    $table->string('receipt_pdf_path', 512)->nullable()->after('invoice_pdf_path');
                }
                if (! Schema::hasColumn('payments', 'emailed_at')) {
                    $table->timestamp('emailed_at')->nullable()->after('receipt_pdf_path');
                }
                if (! Schema::hasColumn('payments', 'notification_sent_at')) {
                    $table->timestamp('notification_sent_at')->nullable()->after('emailed_at');
                }
            });
        }

        if (! Schema::hasTable('notifications')) {
            Schema::create('notifications', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('type');
                $table->morphs('notifiable');
                $table->text('data');
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            if (Schema::hasColumn('payments', 'processed_by_user_id')) {
                $table->dropForeign(['processed_by_user_id']);
            }

            foreach (['notification_sent_at', 'emailed_at', 'receipt_pdf_path', 'processed_by_name', 'processed_by_user_id'] as $column) {
                if (Schema::hasColumn('payments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
