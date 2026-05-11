<?php

use App\Models\AdminNavigationItem;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $rows = [
            ['path' => '/admin/careers', 'label' => 'Careers', 'icon_key' => 'careers', 'sort_order' => 41, 'permission_slug' => 'careers.view', 'match_end' => true],
            ['path' => '/admin/careers/jobs', 'label' => 'Job posts', 'icon_key' => 'careers', 'sort_order' => 42, 'permission_slug' => 'careers.view', 'match_end' => false],
            ['path' => '/admin/careers/applications', 'label' => 'Applicants', 'icon_key' => 'careers', 'sort_order' => 43, 'permission_slug' => 'careers.view', 'match_end' => false],
        ];

        foreach ($rows as $row) {
            AdminNavigationItem::updateOrCreate(
                ['path' => $row['path']],
                [
                    'label' => $row['label'],
                    'icon_key' => $row['icon_key'],
                    'sort_order' => $row['sort_order'],
                    'permission_slug' => $row['permission_slug'],
                    'match_end' => $row['match_end'],
                ]
            );
        }
    }

    public function down(): void
    {
        AdminNavigationItem::query()->whereIn('path', [
            '/admin/careers',
            '/admin/careers/jobs',
            '/admin/careers/applications',
        ])->delete();
    }
};
