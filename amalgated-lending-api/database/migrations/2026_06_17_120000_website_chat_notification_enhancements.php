<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('admin_notifications')) {
            Schema::table('admin_notifications', function (Blueprint $table): void {
                if (! Schema::hasColumn('admin_notifications', 'conversation_id')) {
                    $table->string('conversation_id', 191)->nullable()->after('resource_id')->index();
                }
                if (! Schema::hasColumn('admin_notifications', 'message_id')) {
                    $table->unsignedBigInteger('message_id')->nullable()->after('conversation_id')->index();
                }
                if (! Schema::hasColumn('admin_notifications', 'visitor_id')) {
                    $table->string('visitor_id', 191)->nullable()->after('message_id')->index();
                }
            });
        }

        if (Schema::hasTable('notification_preferences')) {
            Schema::table('notification_preferences', function (Blueprint $table): void {
                if (! Schema::hasColumn('notification_preferences', 'website_chat_settings')) {
                    $table->json('website_chat_settings')->nullable()->after('muted_categories');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('admin_notifications')) {
            Schema::table('admin_notifications', function (Blueprint $table): void {
                foreach (['conversation_id', 'message_id', 'visitor_id'] as $column) {
                    if (Schema::hasColumn('admin_notifications', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('notification_preferences')) {
            Schema::table('notification_preferences', function (Blueprint $table): void {
                if (Schema::hasColumn('notification_preferences', 'website_chat_settings')) {
                    $table->dropColumn('website_chat_settings');
                }
            });
        }
    }
};
