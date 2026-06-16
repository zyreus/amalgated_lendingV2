<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['admin_notifications', 'borrower_notifications'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                if (! Schema::hasColumn($tableName, 'notification_type')) {
                    $table->string('notification_type', 96)->nullable()->after('type')->index();
                }
                if (! Schema::hasColumn($tableName, 'resource_type')) {
                    $table->string('resource_type', 64)->nullable()->after('body')->index();
                }
                if (! Schema::hasColumn($tableName, 'resource_id')) {
                    $table->string('resource_id', 96)->nullable()->after('resource_type')->index();
                }
                if (! Schema::hasColumn($tableName, 'route_name')) {
                    $table->string('route_name', 96)->nullable()->after('resource_id')->index();
                }
                if (! Schema::hasColumn($tableName, 'route_params')) {
                    $table->json('route_params')->nullable()->after('route_name');
                }
                if (! Schema::hasColumn($tableName, 'deleted_at')) {
                    $table->softDeletes();
                }
            });

            DB::table($tableName)
                ->whereNull('notification_type')
                ->update(['notification_type' => DB::raw('type')]);
        }
    }

    public function down(): void
    {
        foreach (['admin_notifications', 'borrower_notifications'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName): void {
                foreach (['route_params', 'route_name', 'resource_id', 'resource_type', 'notification_type', 'deleted_at'] as $column) {
                    if (Schema::hasColumn($tableName, $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
