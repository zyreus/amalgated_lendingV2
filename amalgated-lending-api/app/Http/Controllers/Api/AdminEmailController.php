<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailLog;
use App\Models\FailedNotification;
use App\Services\SmtpMailService;
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
}
