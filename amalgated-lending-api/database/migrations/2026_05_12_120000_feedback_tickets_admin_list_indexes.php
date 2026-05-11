<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        try {
            Schema::table('feedback_tickets', function (Blueprint $table): void {
                $table->index(['status', 'id'], 'feedback_tickets_status_id_idx');
                $table->index(['priority', 'id'], 'feedback_tickets_priority_id_idx');
                $table->index(['publication_status', 'id'], 'feedback_tickets_publication_id_idx');
            });
        } catch (\Throwable) {
            /* index may already exist */
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('feedback_tickets')) {
            return;
        }

        foreach ([
            'feedback_tickets_status_id_idx',
            'feedback_tickets_priority_id_idx',
            'feedback_tickets_publication_id_idx',
        ] as $name) {
            try {
                Schema::table('feedback_tickets', function (Blueprint $table) use ($name): void {
                    $table->dropIndex($name);
                });
            } catch (\Throwable) {
                /* ignore */
            }
        }
    }
};
