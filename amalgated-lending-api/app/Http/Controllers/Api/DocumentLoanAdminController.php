<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentLoanApplication;
use App\Models\UploadedDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentLoanAdminController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = DocumentLoanApplication::query()->with([
            'user:id,name,email,phone',
            'loanProduct:id,name,slug',
        ]);

        if ($request->filled('status')) {
            $q->where('status', $request->query('status'));
        }
        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%'.$search.'%';
            $q->whereIn('user_id', function ($sub) use ($like) {
                $sub->select('id')
                    ->from('users')
                    ->where(function ($w) use ($like) {
                        $w->where('name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });
            });
        }

        $perPage = min(100, max(5, (int) $request->query('per_page', 20)));

        return response()->json(['ok' => true, 'data' => $q->orderByDesc('id')->paginate($perPage)]);
    }

    public function show(DocumentLoanApplication $documentLoanApplication): JsonResponse
    {
        $documentLoanApplication->load(['user', 'loanProduct.loanRequirements', 'uploadedDocuments.loanRequirement']);

        return response()->json(['ok' => true, 'application' => $documentLoanApplication]);
    }

    public function updateUpload(Request $request, UploadedDocument $uploadedDocument): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|string|in:pending,verified,rejected,approved',
            'remarks' => 'nullable|string|max:2000',
        ]);

        $status = $data['status'] === 'approved' ? UploadedDocument::STATUS_VERIFIED : $data['status'];
        $uploadedDocument->status = $status;
        $uploadedDocument->remarks = $data['remarks'] ?? $uploadedDocument->remarks;
        $uploadedDocument->save();

        return response()->json(['ok' => true, 'upload' => $uploadedDocument->fresh('loanRequirement')]);
    }
}
