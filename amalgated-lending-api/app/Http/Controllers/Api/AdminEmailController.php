<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Models\FailedNotification;
use App\Services\SmtpMailService;
use App\Services\TransactionalMailSender;
use Illuminate\Mail\Mailable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminEmailController extends Controller
{
    public function status(SmtpMailService $smtp): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'smtp' => $smtp->status(),
        ]);
    }

    public function health(SmtpMailService $smtp): JsonResponse
    {
        $check = $smtp->healthCheck();

        return response()->json([
            'ok' => $check['ok'],
            'health' => $check,
        ], $check['ok'] ? 200 : 503);
    }

    public function test(Request $request, SmtpMailService $smtp): JsonResponse
    {
        $data = $request->validate([
            'to' => 'required|email|max:191',
        ]);

        if (! $smtp->isConfigured()) {
            return response()->json([
                'ok' => false,
                'message' => 'SMTP is not configured. Set MAIL_HOST, MAIL_USERNAME, and MAIL_PASSWORD in the API .env file.',
            ], 422);
        }

        try {
            $smtp->sendTestEmail(trim($data['to']));

            return response()->json([
                'ok' => true,
                'message' => 'Test email sent to '.$data['to'],
            ]);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'ok' => false,
                'message' => $e->getMessage() ?: 'Could not send test email.',
            ], 500);
        }
    }

    public function logs(Request $request): JsonResponse
    {
        $limit = min(100, max(10, (int) $request->query('limit', 50)));
        $statusFilter = $request->query('status');

        $query = EmailLog::query()->orderByDesc('id');
        if (is_string($statusFilter) && $statusFilter !== '') {
            $query->where('status', $statusFilter);
        } else {
            $query->whereIn('status', [
                EmailLog::STATUS_FAILED,
                EmailLog::STATUS_QUEUED,
                EmailLog::STATUS_SENT,
            ]);
        }

        $emailLogs = $query->limit($limit)->get([
            'id',
            'notification_type',
            'recipient_email',
            'subject',
            'status',
            'transport_detail',
            'error_message',
            'sent_at',
            'updated_at',
        ]);

        $failedNotifications = FailedNotification::query()
            ->where('channel', 'email')
            ->orderByDesc('id')
            ->limit($limit)
            ->get(['id', 'channel', 'error_class', 'error_message', 'payload', 'created_at']);

        return response()->json([
            'ok' => true,
            'email_logs' => $emailLogs,
            'failed_notifications' => $failedNotifications,
        ]);
    }

    public function retry(Request $request, TransactionalMailSender $sender): JsonResponse
    {
        $data = $request->validate([
            'log_id' => 'nullable|integer|exists:email_logs,id',
            'retry_all_failed' => 'nullable|boolean',
        ]);

        $query = EmailLog::query()->where('status', EmailLog::STATUS_FAILED)->orderByDesc('id');
        if (! empty($data['log_id'])) {
            $query->where('id', (int) $data['log_id']);
        }

        $rows = $query->limit(empty($data['retry_all_failed']) ? 1 : 25)->get();
        if ($rows->isEmpty()) {
            return response()->json(['ok' => false, 'message' => 'No failed email log entries to retry.'], 404);
        }

        $results = [];
        foreach ($rows as $row) {
            $results[] = $this->retryEmailLogRow($row, $sender);
        }

        $sent = collect($results)->where('ok', true)->count();

        return response()->json([
            'ok' => $sent > 0,
            'message' => $sent > 0
                ? "Retried {$sent} of ".$rows->count().' failed email(s).'
                : 'Retry attempted but SMTP still failing. Check Admin → Settings → SMTP health.',
            'results' => $results,
        ], $sent > 0 ? 200 : 503);
    }

    public function analytics(): JsonResponse
    {
        $since = now()->subDays(30);

        $byStatus = EmailLog::query()
            ->where('created_at', '>=', $since)
            ->select('status', DB::raw('COUNT(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $byType = EmailLog::query()
            ->where('created_at', '>=', $since)
            ->where('status', EmailLog::STATUS_SENT)
            ->select('notification_type', DB::raw('COUNT(*) as total'))
            ->groupBy('notification_type')
            ->orderByDesc('total')
            ->limit(12)
            ->pluck('total', 'notification_type');

        $failedLast7 = EmailLog::query()
            ->where('status', EmailLog::STATUS_FAILED)
            ->where('created_at', '>=', now()->subDays(7))
            ->count();

        $sentLast24h = EmailLog::query()
            ->where('status', EmailLog::STATUS_SENT)
            ->where('sent_at', '>=', now()->subDay())
            ->count();

        $queueDepth = DB::table('jobs')->where('queue', 'notifications')->count();

        return response()->json([
            'ok' => true,
            'analytics' => [
                'period_days' => 30,
                'by_status' => $byStatus,
                'sent_by_type' => $byType,
                'failed_last_7_days' => $failedLast7,
                'sent_last_24_hours' => $sentLast24h,
                'notifications_queue_depth' => $queueDepth,
            ],
        ]);
    }

    /**
     * @return array{ok: bool, log_id: int, detail?: string}
     */
    private function retryEmailLogRow(EmailLog $row, TransactionalMailSender $sender): array
    {
        $class = (string) ($row->mailable_class ?? '');
        if ($class === '' || ! class_exists($class) || ! is_subclass_of($class, Mailable::class)) {
            return ['ok' => false, 'log_id' => $row->id, 'detail' => 'missing_mailable_class'];
        }

        try {
            $mailable = $this->rebuildMailable($class, $row);
        } catch (\Throwable $e) {
            return ['ok' => false, 'log_id' => $row->id, 'detail' => 'rebuild_failed: '.$e->getMessage()];
        }

        $subject = (string) ($row->subject ?: 'Notification — '.config('app.name'));
        $email = (string) $row->recipient_email;
        $name = (string) ($row->recipient_name ?? '');

        $row->update(['status' => EmailLog::STATUS_QUEUED, 'error_message' => null]);

        $send = $sender->sendHtmlMailable($mailable, $email, $name, $subject, [
            'retry_log_id' => $row->id,
            'notification_type' => $row->notification_type,
        ]);

        $ok = (bool) ($send['ok'] ?? false);
        $detail = (string) ($send['detail'] ?? '');
        $row->update([
            'status' => $ok ? EmailLog::STATUS_SENT : EmailLog::STATUS_FAILED,
            'transport_detail' => $detail !== '' ? $detail : null,
            'error_message' => $ok ? null : ($detail !== '' ? $detail : 'send_failed'),
            'sent_at' => $ok ? now() : null,
        ]);

        return ['ok' => $ok, 'log_id' => $row->id, 'detail' => $detail];
    }

    private function rebuildMailable(string $class, EmailLog $row): Mailable
    {
        return match ($row->notification_type) {
            EmailLog::NOTIFICATION_PAYMENT_RECEIPT => $this->rebuildPaymentReceipt($class, $row),
            EmailLog::NOTIFICATION_LOAN_DECISION => $this->rebuildLoanDecision($class, $row),
            default => throw new \RuntimeException('Retry not supported for type: '.$row->notification_type),
        };
    }

    private function rebuildPaymentReceipt(string $class, EmailLog $row): Mailable
    {
        $payment = \App\Models\Payment::query()->with(['loan.borrower'])->find($row->payment_id);
        if (! $payment) {
            throw new \RuntimeException('Payment not found.');
        }

        return new $class($payment->fresh(['loan.borrower']));
    }

    private function rebuildLoanDecision(string $class, EmailLog $row): Mailable
    {
        $loan = \App\Models\Loan::query()->with('borrower')->find($row->loan_id);
        if (! $loan || ! $loan->borrower) {
            throw new \RuntimeException('Loan not found.');
        }
        $decision = $loan->status === \App\Models\Loan::STATUS_REJECTED ? 'rejected' : 'approved';
        $adminMessage = $decision === 'rejected' ? null : trim((string) ($loan->admin_notes ?? '')) ?: null;

        return new $class($loan, (string) $loan->borrower->name, $decision, $adminMessage);
    }
}
