<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowerNotification;
use App\Models\Loan;
use App\Models\Payment;
use App\Models\User;
use App\Services\NotificationCenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class BorrowerNotificationController extends Controller
{
    /**
     * How often the per-borrower reminder sync may run. Polling endpoints typically fire every
     * 30–60 s — running this expensive job every poll thrashes the DB.
     */
    private const REMINDER_SYNC_TTL_SECONDS = 90;

    /**
     * Sync payment-related reminders from current loan state (idempotent; preserves read_at).
     *
     * @param  Loan|null  $primaryLoan  When the caller already resolved the borrower's primary loan
     *                                   (same rules as the dashboard), pass it to skip a duplicate
     *                                   `loans` query for that request.
     */
    public static function syncPaymentRemindersForUser(User $user, ?Loan $primaryLoan = null): void
    {
        /**
         * Cooldown for all callers: reminders may lag up to the TTL.
         */
        $key = 'borrower_reminder_sync:'.$user->id;
        if (Cache::get($key)) {
            return;
        }
        Cache::put($key, 1, self::REMINDER_SYNC_TTL_SECONDS);

        $loan = self::resolvePrimaryLoanForSync($user, $primaryLoan);

        if (! $loan) {
            return;
        }

        if (! $loan->relationLoaded('payments')) {
            $loan->load(['payments' => fn ($q) => $q->orderBy('due_date')]);
        }
        $pendingRows = collect($loan->payments ?? [])
            ->filter(fn (Payment $p) => $p->status !== Payment::STATUS_PAID)
            ->values();

        $seenDedupe = [];
        $now = now();
        $upsertRows = [];

        foreach ($pendingRows as $row) {
            if (! $row->due_date) {
                continue;
            }
            $days = Carbon::now()->startOfDay()->diffInDays($row->due_date->copy()->startOfDay(), false);
            $dedupe = 'installment:'.$row->id;

            if ($days >= 0 && $days <= 5) {
                $title = 'Upcoming payment';
                $body = 'Payment due in '.$days.' day(s): installment #'.$row->installment_no;
                $seenDedupe[] = $dedupe;
                $upsertRows[] = self::reminderUpsertRow(
                    $user->id,
                    $dedupe,
                    'upcoming_due',
                    $title,
                    $body,
                    ['payment_id' => (int) $row->id],
                    $now,
                );
            } elseif ($days < 0) {
                $title = 'Overdue payment';
                $body = 'Overdue by '.abs($days).' day(s): installment #'.$row->installment_no;
                $seenDedupe[] = $dedupe;
                $upsertRows[] = self::reminderUpsertRow(
                    $user->id,
                    $dedupe,
                    'overdue',
                    $title,
                    $body,
                    ['payment_id' => (int) $row->id],
                    $now,
                );
            }
        }

        if ($upsertRows !== []) {
            BorrowerNotification::upsert(
                $upsertRows,
                ['user_id', 'dedupe_key'],
                ['type', 'title', 'body', 'data', 'category', 'priority', 'module', 'updated_at']
            );
        }

        $deleteQuery = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereIn('type', ['upcoming_due', 'overdue'])
            ->whereNotNull('dedupe_key')
            ->where('dedupe_key', 'like', 'installment:%');

        if ($seenDedupe !== []) {
            $deleteQuery->whereNotIn('dedupe_key', $seenDedupe);
        }

        $deleteQuery->delete();
    }

    /**
     * @return array<string, mixed>
     */
    private static function reminderUpsertRow(
        int $userId,
        string $dedupeKey,
        string $type,
        string $title,
        string $body,
        array $data,
        Carbon $now,
    ): array {
        $category = $type === 'overdue'
            ? NotificationCenter::CATEGORY_PAYMENT_OVERDUE
            : NotificationCenter::CATEGORY_PAYMENT_DUE;

        return [
            'user_id' => $userId,
            'type' => $type,
            'category' => $category,
            'priority' => $type === 'overdue' ? 4 : 3,
            'module' => NotificationCenter::MODULE_PAYMENTS,
            'title' => $title,
            'body' => $body,
            'dedupe_key' => $dedupeKey,
            'data' => json_encode($data),
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    /**
     * Pick the same “primary” loan as the borrower dashboard without hydrating every loan row.
     */
    private static function resolvePrimaryLoanForSync(User $user, ?Loan $primaryLoan): ?Loan
    {
        if ($primaryLoan !== null) {
            return $primaryLoan;
        }

        $loanId = Loan::query()
            ->where('borrower_id', $user->id)
            ->orderByRaw(
                'CASE status WHEN ? THEN 1 WHEN ? THEN 2 WHEN ? THEN 3 WHEN ? THEN 4 WHEN ? THEN 5 ELSE 99 END',
                [
                    Loan::STATUS_ONGOING,
                    Loan::STATUS_APPROVED,
                    Loan::STATUS_PENDING,
                    Loan::STATUS_REJECTED,
                    Loan::STATUS_COMPLETED,
                ]
            )
            ->orderByDesc('id')
            ->value('id');

        if (! $loanId) {
            return null;
        }

        return Loan::query()
            ->whereKey($loanId)
            ->with(['payments' => fn ($q) => $q->orderBy('due_date')])
            ->first();
    }

    public function poll(Request $request): JsonResponse
    {
        $user = $request->user();
        self::syncPaymentRemindersForUser($user);

        $userId = $user->id;
        $stats = DB::selectOne(
            'SELECT (
                SELECT COUNT(*)
                FROM borrower_notifications b_unread
                WHERE b_unread.user_id = ?
                  AND b_unread.archived_at IS NULL
                  AND b_unread.read_at IS NULL
            ) AS unread_count,
            (
                SELECT created_at
                FROM borrower_notifications b_latest
                WHERE b_latest.user_id = ?
                  AND b_latest.archived_at IS NULL
                ORDER BY b_latest.id DESC
                LIMIT 1
            ) AS latest_created_at',
            [$userId, $userId]
        ) ?? (object) ['unread_count' => 0, 'latest_created_at' => null];

        $unread = (int) ($stats->unread_count ?? 0);
        $latestCreated = $stats->latest_created_at ?? null;

        $sinceRaw = $request->query('since');
        $changed = true;
        if (is_string($sinceRaw) && $sinceRaw !== '') {
            try {
                $since = Carbon::parse($sinceRaw);
                $changed = BorrowerNotification::query()
                    ->where('user_id', $userId)
                    ->where(function ($w) use ($since) {
                        $w->where('created_at', '>', $since)
                            ->orWhere('updated_at', '>', $since);
                    })
                    ->exists();
            } catch (\Throwable) {
                $changed = true;
            }
        }

        return response()->json([
            'ok' => true,
            'changed' => $changed,
            'unread_count' => $unread,
            'latest_created_at' => $latestCreated
                ? Carbon::parse($latestCreated)->toIso8601String()
                : null,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $request->boolean('skip_reminder_sync', false)) {
            self::syncPaymentRemindersForUser($user);
        }

        $perPage = max(5, min(60, (int) $request->query('per_page', 30)));
        $q = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('priority')
            ->orderByDesc('created_at');

        $category = trim((string) $request->query('category', ''));
        if ($category !== '') {
            $q->where('category', $category);
        }

        if (! $request->boolean('include_archived')) {
            $q->whereNull('archived_at');
        }

        if ($request->boolean('unread_only')) {
            $q->whereNull('read_at');
        }

        $items = $q->paginate($perPage);

        return response()->json(['ok' => true, 'data' => $items]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $user = $request->user();
        self::syncPaymentRemindersForUser($user);

        $n = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->whereNull('archived_at')
            ->count();

        return response()->json(['ok' => true, 'count' => $n]);
    }

    public function markRead(Request $request, BorrowerNotification $borrowerNotification): JsonResponse
    {
        if ($borrowerNotification->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($borrowerNotification->read_at !== null) {
            return response()->json(['ok' => true]);
        }

        BorrowerNotification::query()
            ->whereKey($borrowerNotification->id)
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function markUnread(Request $request, BorrowerNotification $borrowerNotification): JsonResponse
    {
        if ($borrowerNotification->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($borrowerNotification->read_at === null) {
            return response()->json(['ok' => true]);
        }

        BorrowerNotification::query()
            ->whereKey($borrowerNotification->id)
            ->where('user_id', $request->user()->id)
            ->whereNotNull('read_at')
            ->update(['read_at' => null, 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->whereNull('archived_at')
            ->update(['read_at' => now(), 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function archive(Request $request, BorrowerNotification $borrowerNotification): JsonResponse
    {
        if ($borrowerNotification->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($borrowerNotification->archived_at !== null) {
            return response()->json(['ok' => true]);
        }

        BorrowerNotification::query()
            ->whereKey($borrowerNotification->id)
            ->where('user_id', $request->user()->id)
            ->whereNull('archived_at')
            ->update(['archived_at' => now(), 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function clearAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $archived = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at')
            ->update(['archived_at' => now(), 'updated_at' => now()]);

        return response()->json(['ok' => true, 'archived' => $archived]);
    }
}
