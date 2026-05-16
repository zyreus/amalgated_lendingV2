<?php

use App\Models\AdminNavigationItem;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        AdminNavigationItem::query()->where('path', '/admin/marketing-hub')->delete();
    }

    public function down(): void
    {
        // Intentionally empty — marketing hub removed from the product.
    }
};
