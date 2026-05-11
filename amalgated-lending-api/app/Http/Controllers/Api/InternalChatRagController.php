<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Chat\ChatRagRetrievalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Node chat-server calls this with X-Support-Sync-Secret to inject verified website knowledge per query.
 */
class InternalChatRagController extends Controller
{
    public function context(Request $request, ChatRagRetrievalService $rag): JsonResponse
    {
        $data = $request->validate([
            'query' => 'required|string|max:8000',
            'limit' => 'sometimes|integer|min:1|max:20',
        ]);

        try {
            $out = $rag->retrieve($data['query'], $data['limit'] ?? null);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'ok' => false,
                'context' => '',
                'sources' => [],
                'message' => 'RAG retrieval failed.',
            ], 500);
        }

        return response()->json([
            'ok' => true,
            'context' => $out['context'],
            'sources' => $out['sources'],
        ]);
    }
}
