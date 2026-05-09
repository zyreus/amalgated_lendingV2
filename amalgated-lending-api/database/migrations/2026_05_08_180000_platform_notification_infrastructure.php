<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('admin_notifications')) {
            Schema::create('admin_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('type', 64)->index();
                $table->string('category', 64)->nullable()->index();
                $table->unsignedTinyInteger('priority')->default(2)->index();
                $table->string('module', 64)->nullable()->index();
                $table->string('title');
                $table->text('body')->nullable();
                $table->json('data')->nullable();
                $table->json('delivery_channels')->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamp('dismissed_globally_at')->nullable()->index();
                $table->timestamps();
            });
        } else {
            Schema::table('admin_notifications', function (Blueprint $table) {
                if (! Schema::hasColumn('admin_notifications', 'category')) {
                    $table->string('category', 64)->nullable()->after('type')->index();
                }
                if (! Schema::hasColumn('admin_notifications', 'priority')) {
                    $table->unsignedTinyInteger('priority')->default(2)->after('category')->index();
                }
                if (! Schema::hasColumn('admin_notifications', 'module')) {
                    $table->string('module', 64)->nullable()->after('priority')->index();
                }
                if (! Schema::hasColumn('admin_notifications', 'delivery_channels')) {
                    $table->json('delivery_channels')->nullable()->after('data');
                }
                if (! Schema::hasColumn('admin_notifications', 'dismissed_globally_at')) {
                    $table->timestamp('dismissed_globally_at')->nullable()->after('read_at')->index();
                }
            });

            if (Schema::hasColumn('admin_notifications', 'read_at') && Schema::hasColumn('admin_notifications', 'dismissed_globally_at')) {
                DB::table('admin_notifications')
                    ->whereNotNull('read_at')
                    ->whereNull('dismissed_globally_at')
                    ->update(['dismissed_globally_at' => DB::raw('read_at')]);
            }
        }

        if (! Schema::hasTable('admin_notification_reads')) {
            Schema::create('admin_notification_reads', function (Blueprint $table) {
                $table->id();
                $table->foreignId('admin_notification_id')->constrained('admin_notifications')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamp('read_at');
                $table->timestamps();
                $table->unique(['admin_notification_id', 'user_id'], 'admin_notif_user_unique');
                $table->index(['user_id', 'read_at']);
            });
        }

        if (Schema::hasTable('borrower_notifications')) {
            Schema::table('borrower_notifications', function (Blueprint $table) {
                if (! Schema::hasColumn('borrower_notifications', 'category')) {
                    $table->string('category', 64)->nullable()->after('type')->index();
                }
                if (! Schema::hasColumn('borrower_notifications', 'priority')) {
                    $table->unsignedTinyInteger('priority')->default(2)->after('category')->index();
                }
                if (! Schema::hasColumn('borrower_notifications', 'module')) {
                    $table->string('module', 64)->nullable()->after('priority')->index();
                }
                if (! Schema::hasColumn('borrower_notifications', 'delivery_channels')) {
                    $table->json('delivery_channels')->nullable()->after('data');
                }
                if (! Schema::hasColumn('borrower_notifications', 'archived_at')) {
                    $table->timestamp('archived_at')->nullable()->after('read_at')->index();
                }
            });
        }

        if (! Schema::hasTable('notification_delivery_logs')) {
            Schema::create('notification_delivery_logs', function (Blueprint $table) {
                $table->id();
                $table->string('audience', 24)->index();
                $table->unsignedBigInteger('notification_id')->index();
                $table->string('channel', 32)->index();
                $table->string('status', 24)->index();
                $table->text('detail')->nullable();
                $table->json('meta')->nullable();
                $table->timestamps();
                $table->index(['audience', 'notification_id']);
            });
        }

        if (! Schema::hasTable('notification_preferences')) {
            Schema::create('notification_preferences', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
                $table->boolean('in_app')->default(true);
                $table->boolean('email')->default(true);
                $table->boolean('sms')->default(false);
                $table->json('muted_categories')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('failed_notifications')) {
            Schema::create('failed_notifications', function (Blueprint $table) {
                $table->id();
                $table->string('audience', 24)->index();
                $table->unsignedBigInteger('notification_id')->nullable()->index();
                $table->string('channel', 32)->index();
                $table->string('error_class', 190)->nullable();
                $table->text('error_message')->nullable();
                $table->json('payload')->nullable();
                $table->unsignedSmallInteger('attempts')->default(0);
                $table->timestamp('next_retry_at')->nullable()->index();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('failed_notifications');
        Schema::dropIfExists('notification_preferences');
        Schema::dropIfExists('notification_delivery_logs');
        Schema::dropIfExists('admin_notification_reads');

        if (Schema::hasTable('borrower_notifications')) {
            Schema::table('borrower_notifications', function (Blueprint $table) {
                foreach (['archived_at', 'delivery_channels', 'module', 'priority', 'category'] as $col) {
                    if (Schema::hasColumn('borrower_notifications', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }

        if (Schema::hasTable('admin_notifications')) {
            Schema::table('admin_notifications', function (Blueprint $table) {
                foreach (['dismissed_globally_at', 'delivery_channels', 'module', 'priority', 'category'] as $col) {
                    if (Schema::hasColumn('admin_notifications', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
