<?php

namespace App\Services;

use App\Models\ChatMessage;
use Illuminate\Support\Facades\Date;

class ChatMessageReceiptService
{
    /**
     * Visitor client confirms it has rendered staff messages up to this id → mark those rows read.
     * Staff client confirms it has rendered visitor messages up to this id → mark those rows read.
     */
    public function applyReadThrough(string $sessionId, int $throughId, bool $readerIsVisitor): int
    {
        if ($throughId <= 0) {
            return 0;
        }

        $now = Date::now();

        $q = ChatMessage::query()
            ->where('session_id', $sessionId)
            ->where('is_feedback', false)
            ->where('id', '<=', $throughId)
            ->whereNull('read_at');

        if ($readerIsVisitor) {
            $q->where('is_from_admin', true);
        } else {
            $q->where('is_from_visitor', true);
        }

        return $q->update(['read_at' => $now]);
    }

    /**
     * Recipient fetched payload: mark opposite-party messages as delivered (first touch only).
     */
    public function applyDeliveryThrough(string $sessionId, int $throughId, bool $recipientIsVisitor): int
    {
        if ($throughId <= 0) {
            return 0;
        }

        $now = Date::now();

        $q = ChatMessage::query()
            ->where('session_id', $sessionId)
            ->where('is_feedback', false)
            ->where('id', '<=', $throughId)
            ->whereNull('delivered_at');

        if ($recipientIsVisitor) {
            $q->where('is_from_admin', true);
        } else {
            $q->where('is_from_visitor', true);
        }

        return $q->update(['delivered_at' => $now]);
    }

    public function parseThroughId(?string $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }

        return max(0, (int) $value);
    }
}
