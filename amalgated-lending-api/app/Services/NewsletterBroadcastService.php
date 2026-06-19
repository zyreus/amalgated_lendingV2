<?php

namespace App\Services;

use App\Mail\NewsletterUpdateMail;
use App\Models\CmsContent;
use App\Models\EmailLog;
use App\Models\Lead;

class NewsletterBroadcastService
{
    public const KEY_NEWS = 'landing.newsletter.news';

    public const KEY_ANNOUNCEMENTS = 'landing.newsletter.announcements';

    /**
     * @return array{
     *   changed: bool,
     *   notified: bool,
     *   subscriber_count: int,
     *   emails_sent: int,
     *   emails_failed: int,
     *   news: CmsContent,
     *   announcements: CmsContent
     * }
     */
    public function publish(string $locale, string $newsBody, string $announcementsBody, int $editorUserId): array
    {
        $existingNews = CmsContent::query()
            ->where('section_key', self::KEY_NEWS)
            ->where('locale', $locale)
            ->first();
        $existingAnnouncements = CmsContent::query()
            ->where('section_key', self::KEY_ANNOUNCEMENTS)
            ->where('locale', $locale)
            ->first();

        $previousNewsBody = (string) ($existingNews?->body ?? '');
        $previousAnnouncementsBody = (string) ($existingAnnouncements?->body ?? '');
        $changed = $previousNewsBody !== $newsBody || $previousAnnouncementsBody !== $announcementsBody;

        $newsRow = CmsContent::updateOrCreate(
            ['section_key' => self::KEY_NEWS, 'locale' => $locale],
            [
                'title' => 'News',
                'body' => $newsBody,
                'meta' => null,
                'updated_by' => $editorUserId,
            ]
        );

        $announcementsRow = CmsContent::updateOrCreate(
            ['section_key' => self::KEY_ANNOUNCEMENTS, 'locale' => $locale],
            [
                'title' => 'Announcements',
                'body' => $announcementsBody,
                'meta' => null,
                'updated_by' => $editorUserId,
            ]
        );

        $subscriberCount = $this->subscriberCount();
        $notified = false;
        $emailsSent = 0;
        $emailsFailed = 0;

        if ($changed && $subscriberCount > 0 && $this->hasPublishableContent($newsBody, $announcementsBody)) {
            $contentHash = self::contentHash($newsBody, $announcementsBody);
            $delivery = $this->sendUpdateEmails(
                $contentHash,
                $this->parseItems($announcementsBody),
                $this->parseItems($newsBody),
                $editorUserId,
            );
            $notified = $delivery['sent'] > 0;
            $emailsSent = $delivery['sent'];
            $emailsFailed = $delivery['failed'];
        }

        return [
            'changed' => $changed,
            'notified' => $notified,
            'subscriber_count' => $subscriberCount,
            'emails_sent' => $emailsSent,
            'emails_failed' => $emailsFailed,
            'news' => $newsRow,
            'announcements' => $announcementsRow,
        ];
    }

    public static function contentHash(string $newsBody, string $announcementsBody): string
    {
        return hash('sha256', $newsBody.'|'.$announcementsBody);
    }

    /**
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $announcements
     * @param  list<array{id: string, title: string, summary: string, date: string}>  $news
     * @return array{sent: int, failed: int, subscriber_count: int}
     */
    public function sendUpdateEmails(
        string $contentHash,
        array $announcements,
        array $news,
        ?int $publishedByUserId = null,
    ): array {
        if (! config('mail_automation.newsletter_broadcast_enabled', true)) {
            return ['sent' => 0, 'failed' => 0, 'subscriber_count' => 0];
        }

        $siteUrl = rtrim((string) config('app.frontend_url', 'https://amalgatedlending.com'), '/');
        $subject = 'News & announcements — '.config('app.name');

        $subscribers = Lead::query()
            ->newsletter()
            ->where(function ($q) {
                $q->whereNull('is_archived')->orWhere('is_archived', false);
            })
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->orderByDesc('id')
            ->get()
            ->unique(fn (Lead $lead) => mb_strtolower(trim((string) $lead->email)));

        $sent = 0;
        $failed = 0;

        foreach ($subscribers as $lead) {
            $email = trim((string) $lead->email);
            if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            $name = trim((string) ($lead->name ?? ''));
            if ($name === '') {
                $name = 'Subscriber';
            }

            $dedupeKey = 'newsletter_broadcast:'.$contentHash.':'.md5(mb_strtolower($email));
            $mailable = new NewsletterUpdateMail($name, $announcements, $news, $siteUrl);
            $result = app(EmailAutomationService::class)->sendMailable(
                $mailable,
                $email,
                $name,
                $subject,
                $dedupeKey,
                EmailLog::NOTIFICATION_NEWSLETTER_UPDATE,
                [
                    'content_hash' => $contentHash,
                    'published_by_user_id' => $publishedByUserId,
                    'lead_id' => $lead->id,
                ],
            );

            if (($result['ok'] ?? false) && ($result['detail'] ?? '') !== 'duplicate') {
                $sent++;
            } elseif (! ($result['ok'] ?? false)) {
                $failed++;
            }
        }

        return [
            'sent' => $sent,
            'failed' => $failed,
            'subscriber_count' => $subscribers->count(),
        ];
    }

    public function subscriberCount(): int
    {
        return Lead::query()
            ->newsletter()
            ->where(function ($q) {
                $q->whereNull('is_archived')->orWhere('is_archived', false);
            })
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->get()
            ->unique(fn (Lead $lead) => mb_strtolower(trim((string) $lead->email)))
            ->count();
    }

    private function hasPublishableContent(string $newsBody, string $announcementsBody): bool
    {
        return $this->parseItems($newsBody) !== [] || $this->parseItems($announcementsBody) !== [];
    }

    /**
     * @return list<array{id: string, title: string, summary: string, date: string}>
     */
    private function parseItems(string $body): array
    {
        $body = trim($body);
        if ($body === '') {
            return [];
        }

        try {
            $parsed = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
            if (is_array($parsed)) {
                return array_values(array_map(
                    fn (mixed $row, int $i) => $this->normalizeItem(is_array($row) ? $row : ['title' => (string) $row], $i),
                    $parsed,
                    array_keys($parsed),
                ));
            }
        } catch (\Throwable) {
            // Fall through to line-based legacy format.
        }

        $lines = array_values(array_filter(
            array_map('trim', explode("\n", $body)),
            fn (string $line) => $line !== '',
        ));

        return array_values(array_map(
            fn (string $title, int $i) => $this->normalizeItem(['title' => $title], $i),
            $lines,
            array_keys($lines),
        ));
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{id: string, title: string, summary: string, date: string}
     */
    private function normalizeItem(array $item, int $index): array
    {
        return [
            'id' => (string) ($item['id'] ?? 'item-'.$index),
            'title' => trim((string) ($item['title'] ?? $item['headline'] ?? '')),
            'summary' => trim((string) ($item['summary'] ?? $item['description'] ?? '')),
            'date' => trim((string) ($item['date'] ?? $item['publishedAt'] ?? '')),
        ];
    }
}
