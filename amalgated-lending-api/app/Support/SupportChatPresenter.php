<?php

namespace App\Support;

use App\Models\ChatMessage;

class SupportChatPresenter
{
    public static function message(ChatMessage $row): array
    {
        $senderType = static::effectiveSenderType($row);
        $sender = match ($senderType) {
            'customer' => 'user',
            'system' => 'system',
            'ai' => 'ai',
            'admin' => 'admin',
            default => $row->is_from_visitor ? 'user' : 'admin',
        };

        return [
            'id' => $row->id,
            'session_id' => $row->session_id,
            'visitor_id' => $row->visitor_id,
            'dedupe_key' => $row->dedupe_key,
            'content' => $row->message,
            'sender' => $sender,
            'sender_type' => $senderType,
            'sender_name' => $row->sender_name ?? $row->adminUser?->name,
            'is_from_visitor' => (bool) $row->is_from_visitor,
            'is_from_admin' => (bool) $row->is_from_admin,
            'admin_name' => $row->adminUser?->name ?? ($senderType === 'admin' ? $row->sender_name : null),
            'is_feedback' => (bool) $row->is_feedback,
            'rating' => $row->rating,
            'routing_status' => $row->routing_status,
            'sent_at' => optional($row->sent_at)?->toIso8601String(),
            'delivered_at' => optional($row->delivered_at)?->toIso8601String(),
            'read_at' => optional($row->read_at)?->toIso8601String(),
            'created_at' => optional($row->created_at)?->toIso8601String(),
            'updated_at' => optional($row->updated_at)?->toIso8601String(),
        ];
    }

    public static function effectiveSenderType(ChatMessage $row): string
    {
        $t = strtolower((string) ($row->sender_type ?? ''));
        if ($t !== '') {
            return match ($t) {
                'visitor', 'user', 'customer' => 'customer',
                default => $t,
            };
        }

        if ($row->is_from_visitor) {
            return 'customer';
        }
        if ($row->is_from_admin) {
            return 'admin';
        }

        /** Legacy Laravel rows stored before sender_type existed */
        return 'ai';
    }

    /** Map API / sync strings to DB columns */
    public static function booleansFromSenderType(string $type): array
    {
        $t = strtolower($type);

        return match ($t) {
            'visitor', 'user', 'customer' => ['is_from_visitor' => true, 'is_from_admin' => false],
            'admin' => ['is_from_visitor' => false, 'is_from_admin' => true],
            'ai', 'system' => ['is_from_visitor' => false, 'is_from_admin' => false],
            default => ['is_from_visitor' => false, 'is_from_admin' => false],
        };
    }

    public static function sanitizeBody(string $body): string
    {
        $stripped = preg_replace('#<[^>]+>#', '', $body) ?? $body;

        return trim(mb_substr($stripped, 0, 5000));
    }
}
