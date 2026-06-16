<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('portal_conversations')) {
            Schema::table('portal_conversations', function (Blueprint $table): void {
                if (! Schema::hasColumn('portal_conversations', 'is_archived')) {
                    $table->boolean('is_archived')->default(false)->index()->after('is_pinned');
                }
                if (! Schema::hasColumn('portal_conversations', 'last_read_at')) {
                    $table->timestamp('last_read_at')->nullable()->index()->after('admin_last_seen_at');
                }
                if (! Schema::hasColumn('portal_conversations', 'unread_count')) {
                    $table->unsignedInteger('unread_count')->default(0)->index()->after('last_read_at');
                }
                if (! Schema::hasColumn('portal_conversations', 'deleted_at')) {
                    $table->softDeletes()->after('updated_at');
                }
            });
        }

        if (Schema::hasTable('leads')) {
            Schema::table('leads', function (Blueprint $table): void {
                if (! Schema::hasColumn('leads', 'is_archived')) {
                    $table->boolean('is_archived')->default(false)->index()->after('status');
                }
                if (! Schema::hasColumn('leads', 'archived_at')) {
                    $table->timestamp('archived_at')->nullable()->index()->after('is_archived');
                }
                if (! Schema::hasColumn('leads', 'last_read_at')) {
                    $table->timestamp('last_read_at')->nullable()->index()->after('last_message_at');
                }
                if (! Schema::hasColumn('leads', 'unread_count')) {
                    $table->unsignedInteger('unread_count')->default(0)->index()->after('last_read_at');
                }
                if (! Schema::hasColumn('leads', 'deleted_at')) {
                    $table->softDeletes()->after('updated_at');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('leads')) {
            Schema::table('leads', function (Blueprint $table): void {
                foreach (['deleted_at', 'unread_count', 'last_read_at', 'archived_at', 'is_archived'] as $column) {
                    if (Schema::hasColumn('leads', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }

        if (Schema::hasTable('portal_conversations')) {
            Schema::table('portal_conversations', function (Blueprint $table): void {
                foreach (['deleted_at', 'unread_count', 'last_read_at', 'is_archived'] as $column) {
                    if (Schema::hasColumn('portal_conversations', $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
