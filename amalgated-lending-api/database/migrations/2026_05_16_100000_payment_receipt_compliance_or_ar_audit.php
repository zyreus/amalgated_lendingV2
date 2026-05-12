<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('payments')) {
            return;
        }

        $this->dropOfficialReceiptUniqueIfPresent();

        Schema::table('payments', function (Blueprint $table) {
            if (! Schema::hasColumn('payments', 'acknowledgement_receipt_number')) {
                $table->string('acknowledgement_receipt_number', 64)->nullable()->after('official_receipt_number');
            }
            if (! Schema::hasColumn('payments', 'receipt_issued_by')) {
                $table->foreignId('receipt_issued_by')->nullable()->after('acknowledgement_receipt_number')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'receipt_issued_role')) {
                $table->string('receipt_issued_role', 32)->nullable()->after('receipt_issued_by');
            }
            if (! Schema::hasColumn('payments', 'receipt_issued_at')) {
                $table->timestamp('receipt_issued_at')->nullable()->after('receipt_issued_role');
            }
            if (! Schema::hasColumn('payments', 'verified_by')) {
                $table->foreignId('verified_by')->nullable()->after('notes')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'verified_at')) {
                $table->timestamp('verified_at')->nullable()->after('verified_by');
            }
            if (! Schema::hasColumn('payments', 'approved_by')) {
                $table->foreignId('approved_by')->nullable()->after('verified_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'approved_at')) {
                $table->timestamp('approved_at')->nullable()->after('approved_by');
            }
            if (! Schema::hasColumn('payments', 'recorded_by')) {
                $table->foreignId('recorded_by')->nullable()->after('approved_at')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('payments', 'deleted_at')) {
                $table->softDeletes();
            }
        });

        Schema::table('payments', function (Blueprint $table) {
            if (! $this->indexExists('payments', 'payments_official_receipt_number_idx')) {
                $table->index('official_receipt_number', 'payments_official_receipt_number_idx');
            }
            if (Schema::hasColumn('payments', 'acknowledgement_receipt_number')
                && ! $this->indexExists('payments', 'payments_acknowledgement_receipt_number_idx')) {
                $table->index('acknowledgement_receipt_number', 'payments_acknowledgement_receipt_number_idx');
            }
            if (Schema::hasColumn('payments', 'paid_at') && ! $this->indexExists('payments', 'payments_paid_at_index')) {
                $table->index('paid_at', 'payments_paid_at_index');
            }
            if (Schema::hasColumn('payments', 'recorded_by') && ! $this->indexExists('payments', 'payments_recorded_by_index')) {
                $table->index('recorded_by', 'payments_recorded_by_index');
            }
            if (Schema::hasColumn('payments', 'verified_by') && ! $this->indexExists('payments', 'payments_verified_by_index')) {
                $table->index('verified_by', 'payments_verified_by_index');
            }
        });

        if (Schema::hasColumn('payments', 'approved_by')) {
            DB::table('payments')
                ->whereNull('approved_by')
                ->whereNotNull('confirmed_by')
                ->update([
                    'approved_by' => DB::raw('confirmed_by'),
                    'approved_at' => DB::raw('COALESCE(confirmation_date, updated_at)'),
                ]);
        }

        if (! Schema::hasTable('payment_receipt_audits')) {
            Schema::create('payment_receipt_audits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('action', 48)->index();
                $table->string('official_receipt_number', 64)->nullable();
                $table->string('acknowledgement_receipt_number', 64)->nullable();
                $table->json('meta')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent', 512)->nullable();
                $table->timestamps();

                $table->index(['payment_id', 'created_at'], 'payment_receipt_audits_payment_created_idx');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('payment_receipt_audits')) {
            Schema::dropIfExists('payment_receipt_audits');
        }

        if (! Schema::hasTable('payments')) {
            return;
        }

        Schema::table('payments', function (Blueprint $table) {
            $this->safeDropIndex($table, 'payments_official_receipt_number_idx');
            $this->safeDropIndex($table, 'payments_acknowledgement_receipt_number_idx');
            $this->safeDropIndex($table, 'payments_paid_at_index');
            $this->safeDropIndex($table, 'payments_recorded_by_index');
            $this->safeDropIndex($table, 'payments_verified_by_index');
        });

        Schema::table('payments', function (Blueprint $table) {
            foreach (['receipt_issued_by', 'verified_by', 'approved_by', 'recorded_by'] as $col) {
                if (Schema::hasColumn('payments', $col)) {
                    $table->dropForeign([$col]);
                }
            }
            $cols = [
                'acknowledgement_receipt_number',
                'receipt_issued_by',
                'receipt_issued_role',
                'receipt_issued_at',
                'verified_by',
                'verified_at',
                'approved_by',
                'approved_at',
                'recorded_by',
            ];
            if (Schema::hasColumn('payments', 'deleted_at')) {
                $cols[] = 'deleted_at';
            }
            $cols = array_values(array_filter($cols, fn (string $c) => Schema::hasColumn('payments', $c)));
            if ($cols !== []) {
                $table->dropColumn($cols);
            }
        });
    }

    private function dropOfficialReceiptUniqueIfPresent(): void
    {
        try {
            Schema::table('payments', function (Blueprint $table) {
                $table->dropUnique(['official_receipt_number']);
            });
        } catch (Throwable) {
            // Index may not exist or driver uses a different name.
        }

        try {
            $indexes = Schema::getIndexes('payments');
            foreach ($indexes as $index) {
                $cols = $index['columns'] ?? [];
                $name = $index['name'] ?? '';
                $unique = (bool) ($index['unique'] ?? false);
                if ($unique && $name !== '' && in_array('official_receipt_number', $cols, true)) {
                    Schema::table('payments', function (Blueprint $table) use ($name) {
                        $table->dropIndex($name);
                    });
                    break;
                }
            }
        } catch (Throwable) {
        }
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

    private function safeDropIndex(Blueprint $table, string $indexName): void
    {
        if ($this->indexExists('payments', $indexName)) {
            $table->dropIndex($indexName);
        }
    }
};
