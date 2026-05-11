<?php

namespace App\Support;

use App\Models\FeedbackTicket;
use Illuminate\Support\Facades\DB;

/**
 * Shared duplicate detection for public / chatbot feedback intake.
 */
class FeedbackSubmissionGuard
{
    public static function isRecentDuplicate(?int $borrowerId, ?string $email, int $rating, string $message, int $withinHours = 24): bool
    {
        if (! $borrowerId && (! $email || trim($email) === '')) {
            return false;
        }

        $prefix = mb_substr($message, 0, 80);
        $driver = DB::connection()->getDriverName();
        $messagePrefixSql = match ($driver) {
            'pgsql' => 'SUBSTRING(message FROM 1 FOR 80)',
            default => 'SUBSTR(message, 1, 80)',
        };

        $q = FeedbackTicket::query()
            ->where('created_at', '>=', now()->subHours($withinHours))
            ->where('rating', $rating)
            ->whereRaw($messagePrefixSql.' = ?', [$prefix]);

        if ($borrowerId) {
            $q->where('borrower_id', $borrowerId);
        } else {
            $q->where('email', trim((string) $email));
        }

        return $q->exists();
    }
}
