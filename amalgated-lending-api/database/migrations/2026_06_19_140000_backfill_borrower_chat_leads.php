<?php

use App\Services\BorrowerChatLeadService;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        app(BorrowerChatLeadService::class)->syncMissingForAllBorrowers();
    }

    public function down(): void
    {
        // Intentionally left blank — auto-provisioned chat threads are not removed on rollback.
    }
};
