<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoMaker;
use App\Models\LoanApplication;
use App\Models\LoanDocument;
use App\Services\ActivityLogger;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class BorrowerCoMakerController extends Controller
{
    private const MAX_FILE_KB = 20480;

    private const ALLOWED_MIMES = 'jpg,jpeg,png,pdf';

    /** @return array<string, mixed> */
    private function validationRules(): array
    {
        $relationships = config('co_maker.relationship_options', []);
        $employmentStatuses = config('co_maker.employment_status_options', []);
        $genders = config('co_maker.gender_options', []);
        $idTypes = config('co_maker.valid_id_types', []);

        return [
            'first_name' => 'required|string|max:120',
            'middle_name' => 'nullable|string|max:120',
            'last_name' => 'required|string|max:120',
            'suffix' => 'nullable|string|max:32',
            'date_of_birth' => 'required|date|before:today',
            'gender' => ['required', 'string', 'max:32', Rule::in($genders)],
            'civil_status' => ['required', 'string', 'max:40', Rule::in(config('co_maker.civil_status_options', []))],
            'contact_number' => 'required|string|max:64',
            'alternate_contact_number' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'house_street' => 'required_without:complete_address|nullable|string|max:500',
            'complete_address' => 'required_without:house_street|nullable|string|max:2000',
            'address' => 'nullable|string|max:2000',
            'province' => 'required|string|max:120',
            'city_municipality' => 'required|string|max:120',
            'barangay' => 'required|string|max:120',
            'postal_code' => 'nullable|string|max:16',
            'relationship_to_borrower' => ['required', 'string', 'max:120', Rule::in($relationships)],
            'employment_status' => ['required', 'string', 'max:64', Rule::in($employmentStatuses)],
            'occupation' => 'nullable|string|max:160',
            'employer_business_name' => 'nullable|string|max:255',
            'length_of_employment' => 'nullable|string|max:120',
            'monthly_income' => 'nullable|numeric|min:0',
            'other_income_source' => 'nullable|string|max:2000',
            'valid_id_type' => ['required', 'string', 'max:80', Rule::in($idTypes)],
            'valid_id_number' => 'required|string|max:80',
            'age' => 'nullable|integer|min:0|max:120',
            'sort_order' => 'nullable|integer|min:0|max:999',
        ];
    }

    public function index(Request $request, LoanApplication $loanApplication): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);

        $coMakers = $loanApplication->coMakers()
            ->with(['documents.uploadedBy'])
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (CoMaker $cm) => $this->serializeCoMaker($cm));

        Log::info('co_maker.index.loaded', [
            'loan_application_id' => $loanApplication->id,
            'current_co_maker_count' => $coMakers->count(),
        ]);

        return response()->json(['ok' => true, 'data' => $coMakers]);
    }

    public function store(Request $request, LoanApplication $loanApplication, ActivityLogger $logger): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureEditable($loanApplication);

        $existingCount = $loanApplication->coMakers()->count();
        Log::info('co_maker.store.clicked', [
            'loan_application_id' => $loanApplication->id,
            'user_id' => $request->user()->id,
            'current_co_maker_count' => $existingCount,
        ]);

        $this->normalizeIncomingCoMakerPayload($request);

        $data = $request->validate($this->validationRules());
        Log::info('co_maker.store.validation_passed', [
            'loan_application_id' => $loanApplication->id,
            'current_co_maker_count' => $existingCount,
        ]);

        $data['loan_application_id'] = $loanApplication->id;
        $data['loan_id'] = $loanApplication->loan_id;
        $data['full_name'] = CoMaker::composeFullName($data);
        $data['age'] = $this->computeAge($data['date_of_birth'] ?? null, $data['age'] ?? null);
        $data['address'] = $data['house_street'] ?? $data['complete_address'] ?? $data['address'] ?? null;
        $data['complete_address'] = $data['complete_address'] ?? implode(', ', array_filter([
            $data['house_street'] ?? null,
            $data['barangay'] ?? null,
            $data['city_municipality'] ?? null,
            $data['province'] ?? null,
            $data['postal_code'] ?? null,
        ]));
        $data['sort_order'] = $data['sort_order'] ?? ((int) $loanApplication->coMakers()->max('sort_order')) + 1;
        $data['verification_status'] = CoMaker::VERIFY_PENDING;

        $coMaker = CoMaker::create($data);

        $newCount = $loanApplication->coMakers()->count();
        Log::info('co_maker.store.record_created', [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMaker->id,
            'current_co_maker_count' => $newCount,
        ]);

        $logger->log($request->user(), 'loans.comaker_added', $coMaker, [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMaker->id,
            'new_value' => $this->auditSnapshot($coMaker),
        ], 'loans', $loanApplication->loan_id ?? $loanApplication->id);

        return response()->json(['ok' => true, 'co_maker' => $this->serializeCoMaker($coMaker->fresh(['documents']))], 201);
    }

    public function update(Request $request, LoanApplication $loanApplication, CoMaker $coMaker, ActivityLogger $logger): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureEditable($loanApplication);
        $this->ensureBelongsToApplication($loanApplication, $coMaker);

        $old = $this->auditSnapshot($coMaker);
        $this->normalizeIncomingCoMakerPayload($request);
        $data = $request->validate($this->validationRules());
        $data['full_name'] = CoMaker::composeFullName($data);
        $data['age'] = $this->computeAge($data['date_of_birth'] ?? null, $data['age'] ?? null);
        $data['address'] = $data['house_street'] ?? $data['complete_address'] ?? $data['address'] ?? $coMaker->address;
        $data['complete_address'] = $data['complete_address'] ?? implode(', ', array_filter([
            $data['house_street'] ?? $coMaker->house_street,
            $data['barangay'] ?? $coMaker->barangay,
            $data['city_municipality'] ?? $coMaker->city_municipality,
            $data['province'] ?? $coMaker->province,
            $data['postal_code'] ?? $coMaker->postal_code,
        ]));

        $coMaker->fill($data);
        $coMaker->loan_id = $loanApplication->loan_id;
        $coMaker->save();

        $logger->log($request->user(), 'loans.comaker_updated', $coMaker, [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMaker->id,
            'old_value' => $old,
            'new_value' => $this->auditSnapshot($coMaker),
        ], 'loans', $loanApplication->loan_id ?? $loanApplication->id);

        return response()->json(['ok' => true, 'co_maker' => $this->serializeCoMaker($coMaker->fresh(['documents']))]);
    }

    public function destroy(Request $request, LoanApplication $loanApplication, CoMaker $coMaker, ActivityLogger $logger): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureEditable($loanApplication);
        $this->ensureBelongsToApplication($loanApplication, $coMaker);

        $coMakerId = $coMaker->id;
        $old = $this->auditSnapshot($coMaker);

        foreach ($coMaker->documents as $doc) {
            if ($doc->file_path && Storage::disk('public')->exists($doc->file_path)) {
                Storage::disk('public')->delete($doc->file_path);
            }
            $doc->delete();
        }

        $coMaker->delete();

        $logger->log($request->user(), 'loans.comaker_deleted', $loanApplication, [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMakerId,
            'old_value' => $old,
        ], 'loans', $loanApplication->loan_id ?? $loanApplication->id);

        return response()->json(['ok' => true]);
    }

    public function uploadDocument(Request $request, LoanApplication $loanApplication, CoMaker $coMaker, string $category, ActivityLogger $logger): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureEditable($loanApplication);
        $this->ensureBelongsToApplication($loanApplication, $coMaker);

        if (! in_array($category, CoMaker::DOCUMENT_CATEGORIES, true)) {
            $allowed = array_keys(config('co_maker.document_categories', []));
            if (! in_array($category, $allowed, true)) {
                return response()->json(['ok' => false, 'message' => 'Invalid document category.'], 422);
            }
        }

        $request->validate([
            'file' => 'required|file|mimes:'.self::ALLOWED_MIMES.'|max:'.self::MAX_FILE_KB,
            'document_type' => 'nullable|string|max:80',
        ]);

        $file = $request->file('file');
        $subdir = "co-makers/{$coMaker->id}/{$category}";
        $path = $file->store("loan-documents/{$loanApplication->id}/{$subdir}", 'public');

        $doc = LoanDocument::create([
            'loan_application_id' => $loanApplication->id,
            'loan_id' => $loanApplication->loan_id,
            'co_maker_id' => $coMaker->id,
            'document_type' => $request->input('document_type') ?? $category,
            'document_category' => $category,
            'file_path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'file_size' => $file->getSize(),
            'mime_type' => $file->getMimeType(),
            'uploaded_by' => $request->user()->id,
            'uploaded_at' => now(),
            'verification_status' => LoanDocument::VERIFY_PENDING,
        ]);

        $logger->log($request->user(), 'loans.document_uploaded', $doc, [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMaker->id,
            'document_id' => $doc->id,
            'document_category' => $category,
            'new_value' => ['path' => $path, 'original_name' => $doc->original_name],
        ], 'loans', $loanApplication->loan_id ?? $loanApplication->id);

        return response()->json([
            'ok' => true,
            'document' => $this->serializeDocument($doc),
        ], 201);
    }

    public function destroyDocument(Request $request, LoanApplication $loanApplication, CoMaker $coMaker, LoanDocument $document, ActivityLogger $logger): JsonResponse
    {
        $this->authorizeBorrower($request, $loanApplication);
        $this->ensureEditable($loanApplication);
        $this->ensureBelongsToApplication($loanApplication, $coMaker);

        if ((int) $document->co_maker_id !== (int) $coMaker->id) {
            return response()->json(['ok' => false, 'message' => 'Document not found.'], 404);
        }

        if ($document->verification_status === LoanDocument::VERIFY_VERIFIED) {
            return response()->json(['ok' => false, 'message' => 'Approved documents cannot be deleted.'], 422);
        }

        $path = $document->file_path;
        $docId = $document->id;
        $document->delete();
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }

        $logger->log($request->user(), 'loans.document_deleted', $loanApplication, [
            'loan_application_id' => $loanApplication->id,
            'co_maker_id' => $coMaker->id,
            'document_id' => $docId,
            'old_value' => ['path' => $path],
        ], 'loans', $loanApplication->loan_id ?? $loanApplication->id);

        return response()->json(['ok' => true]);
    }

    private function normalizeIncomingCoMakerPayload(Request $request): void
    {
        $houseStreet = trim((string) $request->input('house_street', ''));
        $completeAddress = trim((string) $request->input('complete_address', ''));
        if ($houseStreet === '' && $completeAddress !== '') {
            $request->merge(['house_street' => $completeAddress]);
            $houseStreet = $completeAddress;
        }
        if ($completeAddress === '' && $houseStreet !== '') {
            $request->merge(['complete_address' => $houseStreet]);
        }

        $relationship = trim((string) $request->input('relationship_to_borrower', ''));
        $allowed = config('co_maker.relationship_options', []);
        if ($relationship !== '' && ! in_array($relationship, $allowed, true)) {
            $request->merge(['relationship_to_borrower' => 'Other']);
        }
    }

    private function authorizeBorrower(Request $request, LoanApplication $loanApplication): void
    {
        if ((int) $loanApplication->user_id !== (int) $request->user()->id) {
            abort(403, 'Forbidden.');
        }
    }

    private function ensureEditable(LoanApplication $loanApplication): void
    {
        if ($loanApplication->isOfficiallySubmitted() && $loanApplication->status !== LoanApplication::STATUS_REJECTED) {
            abort(422, 'Co-makers are locked for this application.');
        }
    }

    private function ensureBelongsToApplication(LoanApplication $loanApplication, CoMaker $coMaker): void
    {
        if ((int) $coMaker->loan_application_id !== (int) $loanApplication->id) {
            abort(404, 'Co-maker not found.');
        }
    }

    /** @return array<string, mixed> */
    private function auditSnapshot(CoMaker $coMaker): array
    {
        return $coMaker->only([
            'id', 'first_name', 'middle_name', 'last_name', 'suffix', 'full_name',
            'email', 'contact_number', 'relationship_to_borrower', 'monthly_income',
        ]);
    }

    private function computeAge(?string $birthdate, ?int $fallback = null): ?int
    {
        if ($fallback !== null) {
            return $fallback;
        }
        if (! $birthdate) {
            return null;
        }
        try {
            return (int) now()->diffInYears(\Carbon\Carbon::parse($birthdate));
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array<string, mixed> */
    private function serializeCoMaker(CoMaker $coMaker): array
    {
        $docsByCategory = [];
        foreach (CoMaker::DOCUMENT_CATEGORIES as $cat) {
            $docsByCategory[$cat] = [];
        }
        foreach ($coMaker->documents ?? [] as $doc) {
            $cat = $doc->document_category ?? 'other_attachments';
            if (! isset($docsByCategory[$cat])) {
                $docsByCategory[$cat] = [];
            }
            $docsByCategory[$cat][] = $this->serializeDocument($doc);
        }

        return [
            'id' => $coMaker->id,
            'first_name' => $coMaker->first_name,
            'middle_name' => $coMaker->middle_name,
            'last_name' => $coMaker->last_name,
            'suffix' => $coMaker->suffix,
            'full_name' => $coMaker->displayName(),
            'date_of_birth' => $coMaker->date_of_birth?->format('Y-m-d'),
            'age' => $coMaker->age,
            'gender' => $coMaker->gender,
            'civil_status' => $coMaker->civil_status,
            'contact_number' => $coMaker->contact_number,
            'alternate_contact_number' => $coMaker->alternate_contact_number,
            'email' => $coMaker->email,
            'house_street' => $coMaker->house_street,
            'relationship_to_borrower' => $coMaker->relationship_to_borrower,
            'employment_status' => $coMaker->employment_status,
            'occupation' => $coMaker->occupation,
            'employer_business_name' => $coMaker->employer_business_name,
            'length_of_employment' => $coMaker->length_of_employment,
            'monthly_income' => $coMaker->monthly_income !== null ? (float) $coMaker->monthly_income : null,
            'other_income_source' => $coMaker->other_income_source,
            'complete_address' => $coMaker->complete_address ?? $coMaker->address,
            'address' => $coMaker->address,
            'province' => $coMaker->province,
            'city_municipality' => $coMaker->city_municipality,
            'barangay' => $coMaker->barangay,
            'postal_code' => $coMaker->postal_code,
            'valid_id_type' => $coMaker->valid_id_type,
            'valid_id_number' => $coMaker->valid_id_number,
            'verification_status' => $coMaker->verification_status ?? CoMaker::VERIFY_PENDING,
            'review_notes' => $coMaker->review_notes,
            'sort_order' => $coMaker->sort_order,
            'documents_by_category' => $docsByCategory,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeDocument(LoanDocument $doc): array
    {
        return [
            'id' => $doc->id,
            'document_type' => $doc->document_type,
            'document_category' => $doc->document_category,
            'file_path' => $doc->file_path,
            'file_url' => $doc->file_path ? PublicStorageUrl::apiUrl($doc->file_path) : null,
            'original_name' => $doc->original_name,
            'file_size' => $doc->file_size,
            'mime_type' => $doc->mime_type,
            'verification_status' => $doc->verification_status,
            'uploaded_at' => $doc->uploaded_at?->toIso8601String(),
        ];
    }
}
