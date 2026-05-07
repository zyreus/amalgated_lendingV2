<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportChatFeedback;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminFeedbackController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $status = strtolower((string) $request->query('status', 'all'));
        $allowed = ['all', 'new', 'read', 'replied'];
        if (! in_array($status, $allowed, true)) {
            $status = 'all';
        }

        $rows = SupportChatFeedback::query()
            ->select([
                'id',
                'session_id',
                'rating',
                'name',
                'email',
                'subject',
                'comment',
                'status',
                'read_at',
                'replied_at',
                'created_at',
            ])
            ->when($status !== 'all', fn ($q) => $q->where('status', $status))
            ->latest()
            ->limit(500)
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $rows,
        ]);
    }

    public function show(SupportChatFeedback $feedback): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'data' => $feedback,
        ]);
    }

    public function updateStatus(Request $request, SupportChatFeedback $feedback): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|string|in:new,read,replied',
        ]);

        $feedback->status = $data['status'];
        if ($data['status'] === 'new') {
            $feedback->read_at = null;
            $feedback->replied_at = null;
        } elseif ($data['status'] === 'read') {
            $feedback->read_at = now();
            $feedback->replied_at = null;
        } else {
            $feedback->read_at = $feedback->read_at ?: now();
            $feedback->replied_at = now();
        }
        $feedback->save();

        return response()->json([
            'ok' => true,
            'data' => $feedback,
        ]);
    }
}
