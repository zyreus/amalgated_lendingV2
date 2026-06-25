<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoMaker;
use App\Models\Loan;
use App\Models\LoanDocument;
use App\Services\ActivityLogger;
use App\Services\DocumentAccessService;
use App\Services\StaffScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class LoanDocumentController extends Controller
{
    private const MAX_FILE_KB = 20480; // 20 MB

    private const ALLOWED_MIMES = 'jpg,jpeg,png,pdf,webp';

    public function __construct(private DocumentAccessService $documentAccess)
    {
    }

    public function index(Request $request, Loan $loan): JsonResponse
    {
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->documentAccess->canView($request->user())) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loan->loadMissing([
            'loanApplication.documents.uploadedBy',
            'loanApplication.coMakers.documents.uploadedBy',
        ]);

        $borrowerDocs = $loan->loanApplication?->documents()
            ->whereNull('co_maker_id')
            ->orderByDesc('id')
            ->get() ?? collect();

        $coMakerDocs = $loan->loanApplication?->documents()
            ->whereNotNull('co_maker_id')
            ->with('coMaker')
            ->orderByDesc('id')
            ->get() ?? collect();

        return response()->json([
            'ok' => true,
            'borrower_documents' => $borrowerDocs,
            'co_maker_documents' => $coMakerDocs,
            'permissions' => $this->documentAccess->permissionsFor($request->user()),
        ]);
    }

    public function store(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->documentAccess->canUpload($request->user())) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loanApp = $loan->loanApplication;
        if (! $loanApp) {
            return response()->json(['ok' => false, 'message' => 'No loan application linked.'], 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:'.self::ALLOWED_MIMES.'|max:'.self::MAX_FILE_KB,
            'document_type' => 'required|string|max:80',
            'document_category' => ['nullable', 'string', Rule::in(CoMaker::DOCUMENT_CATEGORIES)],
            'co_maker_id' => 'nullable|integer|exists:co_makers,id',
            'original_name' => 'nullable|string|max:512',
        ]);

        $coMakerId = $request->input('co_maker_id');
        if ($coMakerId) {
            $belongs = CoMaker::query()
                ->whereKey($coMakerId)
                ->where('loan_application_id', $loanApp->id)
                ->exists();
            if (! $belongs) {
                return response()->json(['ok' => false, 'message' => 'Invalid co-maker for this loan.'], 422);
            }
        }

        $file = $request->file('file');
        $docType = (string) $request->input('document_type');
        $subdir = $coMakerId
            ? "co-makers/{$coMakerId}"
            : ($docType === 'ci_appraisal' ? 'staff/ci-appraisal' : 'borrower');
        $path = $file->store("loan-documents/{$loanApp->id}/{$subdir}", 'public');

        $doc = LoanDocument::create([
            'loan_application_id' => $loanApp->id,
            'loan_id' => $loan->id,
            'co_maker_id' => $coMakerId,
            'document_type' => $request->input('document_type'),
            'document_category' => $request->input('document_category'),
            'file_path' => $path,
            'original_name' => $request->input('original_name') ?? $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $request->user()->id,
            'uploaded_at' => now(),
            'verification_status' => LoanDocument::VERIFY_PENDING,
        ]);

        $logger->log($request->user(), 'loans.document_uploaded', $doc, [
            'loan_id' => $loan->id,
            'document_id' => $doc->id,
            'co_maker_id' => $coMakerId,
        ], 'loans', $loan->id);

        return response()->json(['ok' => true, 'document' => $doc->load('uploadedBy')], 201);
    }

    public function replace(Request $request, Loan $loan, LoanDocument $document, ActivityLogger $logger): JsonResponse
    {
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->documentAccess->canReplace($request->user())) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if ((int) $document->loan_id !== (int) $loan->id
            && (int) ($document->loanApplication?->loan_id ?? 0) !== (int) $loan->id) {
            return response()->json(['ok' => false, 'message' => 'Document not found.'], 404);
        }

        $request->validate([
            'file' => 'required|file|mimes:'.self::ALLOWED_MIMES.'|max:'.self::MAX_FILE_KB,
            'original_name' => 'nullable|string|max:512',
        ]);

        $oldPath = $document->file_path;
        $oldName = $document->original_name;
        $file = $request->file('file');
        $loanApp = $loan->loanApplication;
        if (! $loanApp) {
            return response()->json(['ok' => false, 'message' => 'No loan application linked.'], 422);
        }

        $coMakerId = $document->co_maker_id;
        $subdir = $coMakerId
            ? "co-makers/{$coMakerId}"
            : ($document->document_type === 'ci_appraisal' ? 'staff/ci-appraisal' : 'borrower');
        $path = $file->store("loan-documents/{$loanApp->id}/{$subdir}", 'public');

        $document->file_path = $path;
        $document->original_name = $request->input('original_name') ?? $file->getClientOriginalName();
        $document->file_size = $file->getSize();
        $document->mime_type = $file->getMimeType();
        $document->uploaded_by = $request->user()->id;
        $document->uploaded_at = now();
        $document->verification_status = LoanDocument::VERIFY_PENDING;
        $document->verified_by = null;
        $document->verified_at = null;
        $document->review_notes = null;
        $document->save();

        if ($oldPath && Storage::disk('public')->exists($oldPath)) {
            Storage::disk('public')->delete($oldPath);
        }

        $logger->log($request->user(), 'loans.document_replaced', $document, [
            'loan_id' => $loan->id,
            'document_id' => $document->id,
            'old_value' => ['path' => $oldPath, 'original_name' => $oldName],
            'new_value' => ['path' => $path, 'original_name' => $document->original_name],
        ], 'loans', $loan->id);

        return response()->json(['ok' => true, 'document' => $document->fresh('uploadedBy')]);
    }

    public function destroy(Request $request, Loan $loan, LoanDocument $document, ActivityLogger $logger): JsonResponse
    {
        if (! $this->documentAccess->canDelete($request->user())) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if ((int) $document->loan_id !== (int) $loan->id
            && (int) ($document->loanApplication?->loan_id ?? 0) !== (int) $loan->id) {
            return response()->json(['ok' => false, 'message' => 'Document not found.'], 404);
        }

        $docId = $document->id;
        $path = $document->file_path;
        $document->delete();
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        $logger->log($request->user(), 'loans.document_deleted', $loan, [
            'loan_id' => $loan->id,
            'document_id' => $docId,
            'old_value' => ['path' => $path],
        ], 'loans', $loan->id);

        return response()->json(['ok' => true]);
    }

    private function canAccessLoan(Request $request, Loan $loan): bool
    {
        $staffScope = app(StaffScopeService::class);

        return $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status);
    }
}
