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

class BorrowerNotificationController extends Controller
{
    /**
     * How often the per-borrower reminder sync may run. Polling endpoints typically fire every
     * 30–60 s — running this expensive job every poll thrashes the DB. The dashboard request
     * always passes a primary loan so it bypasses the cooldown.
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
         * Cooldown short-circuit: a borrower polling the bell-icon ~every minute would otherwise
         * re-run the entire payment reconcile + delete query each tick. We still always run when the
         * dashboard explicitly passed a hot Loan model (real user-facing change) — only the cheap
         * polling endpoints honor the cache.
         */
        if ($primaryLoan === null) {
            $key = 'borrower_reminder_sync:'.$user->id;
            if (Cache::get($key)) {
                return;
            }
            Cache::put($key, 1, self::REMINDER_SYNC_TTL_SECONDS);
        }

        $loan = $primaryLoan;

        if ($loan === null) {
            $allLoans = Loan::query()
                ->where('borrower_id', $user->id)
                ->orderByDesc('id')
                ->get();

            if ($allLoans->isEmpty()) {
                return;
            }

            $priority = [
                Loan::STATUS_ONGOING => 1,
                Loan::STATUS_APPROVED => 2,
                Loan::STATUS_PENDING => 3,
                Loan::STATUS_REJECTED => 4,
                Loan::STATUS_COMPLETED => 5,
            ];

            $loan = $allLoans->sort(function ($a, $b) use ($priority) {
                $pa = $priority[$a->status] ?? 99;
                $pb = $priority[$b->status] ?? 99;
                if ($pa !== $pb) {
                    return $pa <=> $pb;
                }

                return $b->id <=> $a->id;
            })->first();
        }

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
                self::upsertReminder($user->id, $dedupe, 'upcoming_due', $title, $body, ['payment_id' => $row->id]);
            } elseif ($days < 0) {
                $title = 'Overdue payment';
                $body = 'Overdue by '.abs($days).' day(s): installment #'.$row->installment_no;
                $seenDedupe[] = $dedupe;
                self::upsertReminder($user->id, $dedupe, 'overdue', $title, $body, ['payment_id' => $row->id]);
            }
        }

        BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereIn('type', ['upcoming_due', 'overdue'])
            ->whereNotNull('dedupe_key')
            ->where('dedupe_key', 'like', 'installment:%')
            ->whereNotIn('dedupe_key', $seenDedupe)
            ->delete();
    }

    private static function upsertReminder(int $userId, string $dedupeKey, string $type, string $title, ?string $body, array $data): void
    {
        $row = BorrowerNotification::query()
            ->where('user_id', $userId)
            ->where('dedupe_key', $dedupeKey)
            ->first();

        if ($row) {
            $row->type = $type;
            $row->title = $title;
            $row->body = $body;
            $row->data = $data;
            $row->save();

            return;
        }

        BorrowerNotification::create([
            'user_id' => $userId,
            'type' => $type,
            'category' => $type === 'overdue' ? NotificationCenter::CATEGORY_PAYMENT_OVERDUE : NotificationCenter::CATEGORY_PAYMENT_DUE,
            'priority' => $type === 'overdue' ? 4 : 3,
            'module' => NotificationCenter::MODULE_PAYMENTS,
            'title' => $title,
            'body' => $body,
            'dedupe_key' => $dedupeKey,
            'data' => $data,
            'read_at' => null,
            'archived_at' => null,
        ]);
    }

    public function poll(Request $request): JsonResponse
    {
        $user = $request->user();
        self::syncPaymentRemindersForUser($user);

        $sinceRaw = $request->query('since');
        $changed = true;
        if (is_string($sinceRaw) && $sinceRaw !== '') {
            try {
                $since = Carbon::parse($sinceRaw);
                $changed = BorrowerNotification::query()
                    ->where('user_id', $user->id)
                    ->where(function ($w) use ($since) {
                        $w->where('created_at', '>', $since)
                            ->orWhere('updated_at', '>', $since);
                    })
                    ->exists();
            } catch (\Throwable) {
                $changed = true;
            }
        }

        $unread = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->whereNull('archived_at')
            ->count();

        $latest = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->orderByDesc('id')
            ->value('created_at');

        return response()->json([
            'ok' => true,
            'changed' => $changed,
            'unread_count' => $unread,
            'latest_created_at' => optional($latest)?->toIso8601String(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        self::syncPaymentRemindersForUser($user);

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
        $borrowerNotification->read_at = now();
        $borrowerNotification->save();

        return response()->json(['ok' => true]);
    }

    public function markUnread(Request $request, BorrowerNotification $borrowerNotification): JsonResponse
    {
        if ($borrowerNotification->user_id !== $request->user()->id) {
            abort(403);
        }
        $borrowerNotification->read_at = null;
        $borrowerNotification->save();

        return response()->json(['ok' => true]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();
        BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->whereNull('archived_at')
            ->update(['read_at' => now()]);

        return response()->json(['ok' => true]);
    }

    public function archive(Request $request, BorrowerNotification $borrowerNotification): JsonResponse
    {
        if ($borrowerNotification->user_id !== $request->user()->id) {
            abort(403);
        }
        $borrowerNotification->archived_at = now();
        $borrowerNotification->save();

        return response()->json(['ok' => true]);
    }

    public function clearAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $archived = BorrowerNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('archived_at')
            ->update(['archived_at' => now()]);

        return response()->json(['ok' => true, 'archived' => $archived]);
    }
}
