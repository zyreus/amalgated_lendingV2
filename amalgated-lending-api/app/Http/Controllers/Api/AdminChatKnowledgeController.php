<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatKnowledgeChunk;
use App\Models\ChatKnowledgeDocument;
use App\Services\Chat\ChatKnowledgeIngestionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminChatKnowledgeController extends Controller
{
    public function stats(): JsonResponse
    {
        return response()->json([
            'ok' => true,
            'documents' => ChatKnowledgeDocument::query()->count(),
            'chunks' => ChatKnowledgeChunk::query()->count(),
            'chunks_with_embeddings' => ChatKnowledgeChunk::query()->whereNotNull('embedding_json')->count(),
            'last_sync_at' => Cache::get('chat_knowledge:last_sync_at'),
        ]);
    }

    public function sync(Request $request, ChatKnowledgeIngestionService $ingestion): JsonResponse
    {
        $withEmbeddings = filter_var($request->input('embeddings', true), FILTER_VALIDATE_BOOL);

        try {
            $stats = $ingestion->syncAll($withEmbeddings);
        } catch (\Throwable $e) {
            report($e);

            return response()->json([
                'ok' => false,
                'message' => $e->getMessage(),
            ], 500);
        }

        return response()->json(['ok' => true, 'stats' => $stats]);
    }
}
