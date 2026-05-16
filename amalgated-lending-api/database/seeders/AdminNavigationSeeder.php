<?php

namespace Database\Seeders;

use App\Models\AdminNavigationItem;
use Illuminate\Database\Seeder;

/**
 * Admin SPA sidebar — stored in DB so labels/order/paths can change without redeploying React.
 */
class AdminNavigationSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['path' => '/admin', 'label' => 'Dashboard', 'icon_key' => 'dash', 'sort_order' => 10, 'permission_slug' => 'dashboard.view', 'match_end' => true],
            ['path' => '/admin/users', 'label' => 'Users', 'icon_key' => 'users', 'sort_order' => 20, 'permission_slug' => 'users.view', 'match_end' => false],
            ['path' => '/admin/roles', 'label' => 'Roles & Permissions', 'icon_key' => 'roles', 'sort_order' => 30, 'permission_slug' => 'roles.manage', 'match_end' => false],
            ['path' => '/admin/borrowers', 'label' => 'Borrowers', 'icon_key' => 'borrowers', 'sort_order' => 40, 'permission_slug' => 'borrowers.view', 'match_end' => false],
            ['path' => '/admin/loan-products', 'label' => 'Loan Products', 'icon_key' => 'products', 'sort_order' => 45, 'permission_slug' => 'loans.view', 'match_end' => false],
            ['path' => '/admin/underwriting-queue', 'label' => 'Underwriting queue', 'icon_key' => 'loans', 'sort_order' => 48, 'permission_slug' => 'loans.view', 'match_end' => false],
            ['path' => '/admin/document-verification', 'label' => 'Document verification', 'icon_key' => 'forms', 'sort_order' => 49, 'permission_slug' => 'loans.view', 'match_end' => false],
            ['path' => '/admin/loans', 'label' => 'Applications', 'icon_key' => 'loans', 'sort_order' => 50, 'permission_slug' => 'loans.view', 'match_end' => false],
            ['path' => '/admin/payments', 'label' => 'Payments', 'icon_key' => 'pay', 'sort_order' => 60, 'permission_slug' => 'payments.manage', 'match_end' => false],
            ['path' => '/admin/collections', 'label' => 'Collections', 'icon_key' => 'pay', 'sort_order' => 62, 'permission_slug' => 'payments.manage', 'match_end' => false],
            ['path' => '/admin/reports', 'label' => 'Reports', 'icon_key' => 'report', 'sort_order' => 70, 'permission_slug' => 'reports.view', 'match_end' => false],
            ['path' => '/admin/risk-analytics', 'label' => 'Risk analytics', 'icon_key' => 'report', 'sort_order' => 71, 'permission_slug' => 'reports.view', 'match_end' => false],
            ['path' => '/admin/compliance', 'label' => 'Compliance center', 'icon_key' => 'activity', 'sort_order' => 72, 'permission_slug' => 'activity.view', 'match_end' => false],
            ['path' => '/admin/cms', 'label' => 'CMS', 'icon_key' => 'cms', 'sort_order' => 80, 'permission_slug' => 'cms.manage', 'match_end' => false],
            ['path' => '/admin/newsletter', 'label' => 'News & announcements', 'icon_key' => 'bell', 'sort_order' => 87, 'permission_slug' => 'cms.manage', 'match_end' => false],
            ['path' => '/admin/printable-forms', 'label' => 'Printable PDF forms', 'icon_key' => 'forms', 'sort_order' => 89, 'permission_slug' => 'forms.printable.manage', 'match_end' => false],
            ['path' => '/admin/settings', 'label' => 'Settings', 'icon_key' => 'settings', 'sort_order' => 90, 'permission_slug' => 'settings.manage', 'match_end' => false],
            ['path' => '/admin/activity', 'label' => 'Activity Logs', 'icon_key' => 'activity', 'sort_order' => 100, 'permission_slug' => 'activity.view', 'match_end' => false],
            ['path' => '/admin/notifications', 'label' => 'Notifications', 'icon_key' => 'bell', 'sort_order' => 110, 'permission_slug' => 'notifications.view', 'match_end' => false],
            ['path' => '/admin/chat-crm', 'label' => 'CRM & Chat', 'icon_key' => 'chat', 'sort_order' => 115, 'permission_slug' => null, 'match_end' => false],
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

        // Standalone /admin/leads page removed — CRM lives under Chat Dashboard only.
        AdminNavigationItem::query()->whereIn('path', ['/admin/leads', '/admin/marketing-hub'])->delete();
    }
}
