<?php

use App\Models\Payment;
use App\Services\PaymentReceiptStatusManager;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'receipt_status')) {
                $table->string('receipt_status', 32)->nullable()->after('acknowledgement_receipt_number');
            }
        });

        if (Schema::hasColumn('payments', 'receipt_status')) {
            $manager = new PaymentReceiptStatusManager;
            Payment::query()->orderBy('id')->chunkById(250, function ($payments) use ($manager): void {
                foreach ($payments as $payment) {
                    $payment->receipt_status = $manager->compute($payment);
                    $payment->saveQuietly();
                }
            });

            $migration = $this;
            Schema::table('payments', function (Blueprint $table) use ($migration): void {
                if (! $migration->indexExists('payments', 'payments_receipt_status_idx')) {
                    $table->index('receipt_status', 'payments_receipt_status_idx');
                }
                if (Schema::hasColumn('payments', 'approved_by') && ! $migration->indexExists('payments', 'payments_approved_by_idx')) {
                    $table->index('approved_by', 'payments_approved_by_idx');
                }
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        $migration = $this;
        Schema::table('payments', function (Blueprint $table) use ($migration): void {
            if ($migration->indexExists('payments', 'payments_receipt_status_idx')) {
                $table->dropIndex('payments_receipt_status_idx');
            }
            if ($migration->indexExists('payments', 'payments_approved_by_idx')) {
                $table->dropIndex('payments_approved_by_idx');
            }
            if (Schema::hasColumn('payments', 'receipt_status')) {
                $table->dropColumn('receipt_status');
            }
        });
    }

    private function indexExists(string $table, string $indexName): bool
    {
        try {
            foreach (Schema::getIndexes($table) as $index) {
                if (($index['name'] ?? '') === $indexName) {
                    return true;
                }
            }
        } catch (Throwable) {
        }

        return false;
    }
};
