<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('co_makers', function (Blueprint $table) {
            $columns = [
                'gender' => fn () => $table->string('gender', 32)->nullable()->after('civil_status'),
                'age' => fn () => $table->unsignedTinyInteger('age')->nullable()->after('gender'),
                'alternate_contact_number' => fn () => $table->string('alternate_contact_number', 64)->nullable()->after('contact_number'),
                'house_street' => fn () => $table->string('house_street', 500)->nullable()->after('address'),
                'employment_status' => fn () => $table->string('employment_status', 64)->nullable()->after('relationship_to_borrower'),
                'length_of_employment' => fn () => $table->string('length_of_employment', 120)->nullable()->after('employer_business_name'),
                'other_income_source' => fn () => $table->text('other_income_source')->nullable()->after('monthly_income'),
                'verification_status' => fn () => $table->string('verification_status', 32)->default('pending')->after('sort_order'),
                'review_notes' => fn () => $table->text('review_notes')->nullable()->after('verification_status'),
                'reviewed_by' => fn () => $table->foreignId('reviewed_by')->nullable()->after('review_notes')->constrained('users')->nullOnDelete(),
                'reviewed_at' => fn () => $table->timestamp('reviewed_at')->nullable()->after('reviewed_by'),
            ];

            foreach ($columns as $name => $callback) {
                if (! Schema::hasColumn('co_makers', $name)) {
                    $callback();
                }
            }
        });
    }

    public function down(): void
    {
        Schema::table('co_makers', function (Blueprint $table) {
            if (Schema::hasColumn('co_makers', 'reviewed_by')) {
                $table->dropForeign(['reviewed_by']);
            }
            foreach ([
                'reviewed_at', 'reviewed_by', 'review_notes', 'verification_status',
                'other_income_source', 'length_of_employment', 'employment_status',
                'house_street', 'alternate_contact_number', 'age', 'gender',
            ] as $col) {
                if (Schema::hasColumn('co_makers', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
