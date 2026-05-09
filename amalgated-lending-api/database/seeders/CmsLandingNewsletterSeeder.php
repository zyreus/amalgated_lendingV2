<?php

namespace Database\Seeders;

use App\Models\CmsContent;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Default landing "News" and "Announcements" blocks (editable in admin → News & Announcements).
 */
class CmsLandingNewsletterSeeder extends Seeder
{
    public function run(): void
    {
        $adminUsername = env('ADMIN_SEED_USERNAME', 'admin');
        $adminEmail = $adminUsername.'@amalgated-lending.local';
        $editorId = User::query()->where('email', $adminEmail)->value('id');

        $newsItems = [
            [
                'id' => 'seed-news-1',
                'title' => 'Transparent loan terms',
                'summary' => 'We publish clear rates and fees so you can compare products with confidence before you apply.',
                'date' => date('M Y'),
            ],
            [
                'id' => 'seed-news-2',
                'title' => 'Digital applications',
                'summary' => 'Start your application online and track status from inquiry through approval.',
                'date' => date('M Y'),
            ],
        ];

        $announcementItems = [
            [
                'id' => 'seed-ann-1',
                'title' => 'Office hours',
                'summary' => 'Our team is available on business days to answer questions about products and requirements.',
                'date' => date('M Y'),
            ],
            [
                'id' => 'seed-ann-2',
                'title' => 'Bring complete documents',
                'summary' => 'Having valid IDs and income proof ready helps us process your request faster.',
                'date' => date('M Y'),
            ],
        ];

        CmsContent::updateOrCreate(
            ['section_key' => 'landing.newsletter.news', 'locale' => 'en'],
            [
                'title' => 'News',
                'body' => json_encode($newsItems, JSON_UNESCAPED_UNICODE),
                'meta' => null,
                'updated_by' => $editorId,
            ]
        );

        CmsContent::updateOrCreate(
            ['section_key' => 'landing.newsletter.announcements', 'locale' => 'en'],
            [
                'title' => 'Announcements',
                'body' => json_encode($announcementItems, JSON_UNESCAPED_UNICODE),
                'meta' => null,
                'updated_by' => $editorId,
            ]
        );
    }
}
