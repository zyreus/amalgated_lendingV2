<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Bootstrap permissions & roles in the database (editable later via admin API).
     */
    public function run(): void
    {
        $permissionDefs = [
            ['name' => 'View dashboard', 'slug' => 'dashboard.view', 'group_name' => 'Dashboard'],
            ['name' => 'View users', 'slug' => 'users.view', 'group_name' => 'Users'],
            ['name' => 'Manage users', 'slug' => 'users.manage', 'group_name' => 'Users'],
            ['name' => 'Manage roles & permissions', 'slug' => 'roles.manage', 'group_name' => 'Roles'],
            ['name' => 'View loans', 'slug' => 'loans.view', 'group_name' => 'Loans'],
            ['name' => 'Approve / reject loans', 'slug' => 'loans.approve', 'group_name' => 'Loans'],
            ['name' => 'Assign loan officer', 'slug' => 'loans.assign', 'group_name' => 'Loans'],
            ['name' => 'Manage payments', 'slug' => 'payments.manage', 'group_name' => 'Payments'],
            ['name' => 'Adjust final loan payment', 'slug' => 'payments.adjust_final', 'group_name' => 'Payments'],
            ['name' => 'View borrowers', 'slug' => 'borrowers.view', 'group_name' => 'Borrowers'],
            ['name' => 'Delete borrowers', 'slug' => 'borrowers.delete', 'group_name' => 'Borrowers'],
            ['name' => 'View reports', 'slug' => 'reports.view', 'group_name' => 'Reports'],
            ['name' => 'Manage CMS', 'slug' => 'cms.manage', 'group_name' => 'CMS'],
            ['name' => 'Manage settings', 'slug' => 'settings.manage', 'group_name' => 'Settings'],
            ['name' => 'View activity logs', 'slug' => 'activity.view', 'group_name' => 'Audit'],
            ['name' => 'View notifications', 'slug' => 'notifications.view', 'group_name' => 'Notifications'],
            ['name' => 'Manage printable PDF forms', 'slug' => 'forms.printable.manage', 'group_name' => 'Forms'],
        ];

        $ids = [];
        foreach ($permissionDefs as $def) {
            $p = Permission::updateOrCreate(
                ['slug' => $def['slug']],
                ['name' => $def['name'], 'group_name' => $def['group_name']]
            );
            $ids[] = $p->id;
        }

        $super = Role::updateOrCreate(
            ['slug' => 'super-admin'],
            ['name' => 'Super Admin', 'description' => 'Full access — managed via database.']
        );
        $super->permissions()->sync($ids);

        $bySlug = Permission::whereIn('slug', [
            'dashboard.view', 'loans.view', 'loans.approve', 'loans.assign', 'borrowers.view',
            'payments.manage', 'notifications.view', 'reports.view',
        ])->pluck('id')->all();
        Role::updateOrCreate(
            ['slug' => 'loan-officer'],
            ['name' => 'Loan Officer', 'description' => 'Origination, approval, and borrower contact.']
        )->permissions()->sync($bySlug);

        Role::updateOrCreate(
            ['slug' => 'collector'],
            ['name' => 'Collector', 'description' => 'Collections and payment recording.']
        )->permissions()->sync(Permission::whereIn('slug', [
            'dashboard.view', 'loans.view', 'borrowers.view', 'payments.manage', 'notifications.view',
        ])->pluck('id')->all());

        Role::updateOrCreate(
            ['slug' => 'accountant'],
            ['name' => 'Accountant', 'description' => 'Financial reporting and payment oversight.']
        )->permissions()->sync(Permission::whereIn('slug', [
            'dashboard.view', 'loans.view', 'payments.manage', 'reports.view', 'notifications.view',
        ])->pluck('id')->all());

        Role::updateOrCreate(
            ['slug' => 'borrower'],
            ['name' => 'Borrower', 'description' => 'Borrower profile (no admin permissions by default).']
        );

        $adminUsername = env('ADMIN_SEED_USERNAME', 'admin');
        $adminPass = env('ADMIN_SEED_PASSWORD', 'admin123');
        $adminEmail = $adminUsername.'@amalgated-lending.local';

        $user = User::updateOrCreate(
            ['email' => $adminEmail],
            [
                'name' => 'System Administrator',
                'username' => $adminUsername,
                'password' => Hash::make($adminPass),
                'is_active' => true,
                'role' => 'admin',
            ]
        );
        $user->roles()->syncWithoutDetaching([$super->id]);

        $settingsDefaults = [
            'loan_defaults' => [
                'interest_rate' => 12,
                'min_loan' => 5000,
                'max_loan' => 500000,
                'min_term_months' => 3,
                'max_term_months' => 60,
                'penalty_percent' => 2,
            ],
            'payment_settings' => [
                'currency' => 'PHP',
                'methods' => ['cash', 'bank_transfer', 'gcash'],
                'require_proof' => true,
            ],
            'interest_settings' => [
                'mode' => 'reducing_balance',
                'compounding' => false,
            ],
            'notifications' => [
                'email_enabled' => true,
                'sms_enabled' => false,
                'reminder_days' => [1, 3, 7],
            ],
            'credit_scoring' => [
                'enabled' => true,
                'base_score' => 650,
                'rules' => [
                    'on_time_payment_bonus' => 2,
                    'late_payment_penalty' => 5,
                ],
            ],
            'security' => [
                'two_factor_enabled' => false,
                'max_login_attempts' => 5,
            ],
            'branding' => [
                'primary_color' => '#ff0000',
                'background_color' => '#000000',
                'surface_color' => '#0a0a0a',
                'logo_url' => null,
            ],
            'system' => [
                'maintenance_mode' => false,
                'backup_frequency' => 'daily',
            ],
        ];

        foreach ($settingsDefaults as $k => $v) {
            SystemSetting::updateOrCreate(['key' => $k], ['value' => $v]);
        }

        $this->call(AdminNavigationSeeder::class);
        $this->call(LoanProductSeeder::class);
        $this->call(PrintableFormSeeder::class);
        $this->call(CmsLandingNewsletterSeeder::class);
    }
}
