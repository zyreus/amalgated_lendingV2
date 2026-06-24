<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CoMaker;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Services\ActivityLogger;
use App\Services\StaffScopeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CoMakerController extends Controller
{
    /** @return array<string, mixed> */
    private function validationRules(?int $coMakerId = null): array
    {
        $relationships = config('co_maker.relationship_options', []);
        $employmentStatuses = config('co_maker.employment_status_options', []);
        $genders = config('co_maker.gender_options', []);
        $idTypes = config('co_maker.valid_id_types', []);

        return [
            'first_name' => 'nullable|string|max:120',
            'middle_name' => 'nullable|string|max:120',
            'last_name' => 'nullable|string|max:120',
            'suffix' => 'nullable|string|max:32',
            'full_name' => 'nullable|string|max:255',
            'date_of_birth' => 'nullable|date|before:today',
            'gender' => ['nullable', 'string', 'max:32', Rule::in($genders)],
            'civil_status' => ['nullable', 'string', 'max:40', Rule::in(config('co_maker.civil_status_options', []))],
            'address' => 'nullable|string|max:2000',
            'house_street' => 'nullable|string|max:500',
            'complete_address' => 'nullable|string|max:2000',
            'province' => 'nullable|string|max:120',
            'city_municipality' => 'nullable|string|max:120',
            'barangay' => 'nullable|string|max:120',
            'postal_code' => 'nullable|string|max:16',
            'contact_number' => 'nullable|string|max:64',
            'alternate_contact_number' => 'nullable|string|max:64',
            'email' => 'nullable|email|max:255',
            'relationship_to_borrower' => ['nullable', 'string', 'max:120', Rule::in($relationships)],
            'employment_status' => ['nullable', 'string', 'max:64', Rule::in($employmentStatuses)],
            'occupation' => 'nullable|string|max:160',
            'employer_business_name' => 'nullable|string|max:255',
            'length_of_employment' => 'nullable|string|max:120',
            'monthly_income' => 'nullable|numeric|min:0',
            'other_income_source' => 'nullable|string|max:2000',
            'valid_id_type' => ['nullable', 'string', 'max:80', Rule::in($idTypes)],
            'valid_id_number' => 'nullable|string|max:80',
            'age' => 'nullable|integer|min:0|max:120',
            'sort_order' => 'nullable|integer|min:0|max:999',
        ];
    }

    public function index(Request $request, Loan $loan): JsonResponse
    {
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loan->loadMissing('loanApplication.coMakers.documents.uploadedBy');
        $coMakers = ($loan->loanApplication?->coMakers ?? collect())
            ->map(fn (CoMaker $cm) => $this->serializeCoMaker($cm));

        return response()->json(['ok' => true, 'data' => $coMakers]);
    }

    public function store(Request $request, Loan $loan, ActivityLogger $logger): JsonResponse
    {
        if (! $request->user()->hasPermission('loans.comakers.manage') && ! $request->user()->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        $loanApp = $loan->loanApplication;
        if (! $loanApp) {
            return response()->json(['ok' => false, 'message' => 'No loan application linked to this loan.'], 422);
        }

        $data = $request->validate($this->validationRules());
        if (empty($data['full_name']) && empty($data['first_name']) && empty($data['last_name'])) {
            return response()->json(['ok' => false, 'message' => 'Co-maker name is required.'], 422);
        }
        $data['full_name'] = CoMaker::composeFullName($data);
        $data['address'] = $data['house_street'] ?? $data['complete_address'] ?? $data['address'] ?? null;
        $data['complete_address'] = $data['complete_address'] ?? implode(', ', array_filter([
            $data['house_street'] ?? null,
            $data['barangay'] ?? null,
            $data['city_municipality'] ?? null,
            $data['province'] ?? null,
            $data['postal_code'] ?? null,
        ]));
        $data['loan_application_id'] = $loanApp->id;
        $data['loan_id'] = $loan->id;
        $data['sort_order'] = $data['sort_order'] ?? ((int) $loanApp->coMakers()->max('sort_order')) + 1;

        $coMaker = CoMaker::create($data);
        $logger->log($request->user(), 'loans.comaker_added', $coMaker, [
            'loan_id' => $loan->id,
            'co_maker_id' => $coMaker->id,
        ], 'loans', $loan->id);

        return response()->json(['ok' => true, 'co_maker' => $this->serializeCoMaker($coMaker->fresh(['documents']))], 201);
    }

    public function update(Request $request, Loan $loan, CoMaker $coMaker, ActivityLogger $logger): JsonResponse
    {
        if (! $request->user()->hasPermission('loans.comakers.manage') && ! $request->user()->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->belongsToLoan($loan, $coMaker)) {
            return response()->json(['ok' => false, 'message' => 'Co-maker not found for this loan.'], 404);
        }

        $data = $request->validate($this->validationRules($coMaker->id));
        if (isset($data['first_name']) || isset($data['last_name']) || isset($data['full_name'])) {
            $data['full_name'] = CoMaker::composeFullName(array_merge($coMaker->toArray(), $data));
        }
        if (array_key_exists('complete_address', $data) || array_key_exists('address', $data) || array_key_exists('house_street', $data)) {
            $data['address'] = $data['house_street'] ?? $data['complete_address'] ?? $data['address'] ?? $coMaker->address;
            $data['complete_address'] = $data['complete_address'] ?? implode(', ', array_filter([
                $data['house_street'] ?? $coMaker->house_street,
                $data['barangay'] ?? $coMaker->barangay,
                $data['city_municipality'] ?? $coMaker->city_municipality,
                $data['province'] ?? $coMaker->province,
                $data['postal_code'] ?? $coMaker->postal_code,
            ]));
        }
        $coMaker->fill($data);
        $coMaker->loan_id = $loan->id;
        $coMaker->save();

        $logger->log($request->user(), 'loans.comaker_updated', $coMaker, [
            'loan_id' => $loan->id,
            'co_maker_id' => $coMaker->id,
        ], 'loans', $loan->id);

        return response()->json(['ok' => true, 'co_maker' => $this->serializeCoMaker($coMaker->fresh(['documents']))]);
    }

    public function destroy(Request $request, Loan $loan, CoMaker $coMaker, ActivityLogger $logger): JsonResponse
    {
        if (! $request->user()->hasPermission('loans.comakers.manage') && ! $request->user()->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->belongsToLoan($loan, $coMaker)) {
            return response()->json(['ok' => false, 'message' => 'Co-maker not found for this loan.'], 404);
        }

        $coMakerId = $coMaker->id;
        $coMaker->delete();
        $logger->log($request->user(), 'loans.comaker_deleted', $loan, [
            'loan_id' => $loan->id,
            'co_maker_id' => $coMakerId,
        ], 'loans', $loan->id);

        return response()->json(['ok' => true]);
    }

    public function review(Request $request, Loan $loan, CoMaker $coMaker, ActivityLogger $logger): JsonResponse
    {
        if (! $request->user()->hasPermission('loans.comakers.manage') && ! $request->user()->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->canAccessLoan($request, $loan)) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }
        if (! $this->belongsToLoan($loan, $coMaker)) {
            return response()->json(['ok' => false, 'message' => 'Co-maker not found for this loan.'], 404);
        }

        $data = $request->validate([
            'verification_status' => ['required', 'string', Rule::in([
                CoMaker::VERIFY_APPROVED,
                CoMaker::VERIFY_REJECTED,
                CoMaker::VERIFY_REQUIRES_RESUBMISSION,
                CoMaker::VERIFY_PENDING,
            ])],
            'review_notes' => 'nullable|string|max:5000',
        ]);

        $coMaker->verification_status = $data['verification_status'];
        $coMaker->review_notes = $data['review_notes'] ?? null;
        $coMaker->reviewed_by = $request->user()->id;
        $coMaker->reviewed_at = now();
        $coMaker->save();

        $logger->log($request->user(), 'loans.comaker_reviewed', $coMaker, [
            'loan_id' => $loan->id,
            'co_maker_id' => $coMaker->id,
            'verification_status' => $coMaker->verification_status,
        ], 'loans', $loan->id);

        return response()->json(['ok' => true, 'co_maker' => $coMaker->fresh()]);
    }

    /** @return array<string, mixed> */
    private function serializeCoMaker(CoMaker $coMaker): array
    {
        $coMaker->loadMissing('documents');

        $docsByCategory = [];
        foreach (CoMaker::DOCUMENT_CATEGORIES as $cat) {
            $docsByCategory[$cat] = [];
        }
        foreach ($coMaker->documents as $doc) {
            $cat = $doc->document_category ?? CoMaker::DOC_CATEGORY_OTHER;
            if (! isset($docsByCategory[$cat])) {
                $docsByCategory[$cat] = [];
            }
            $docsByCategory[$cat][] = [
                'id' => $doc->id,
                'original_name' => $doc->original_name,
                'file_url' => $doc->file_path ? \App\Support\PublicStorageUrl::apiUrl($doc->file_path) : null,
                'file_path' => $doc->file_path,
                'mime_type' => $doc->mime_type,
                'verification_status' => $doc->verification_status,
            ];
        }

        return array_merge($coMaker->only([
            'id', 'first_name', 'middle_name', 'last_name', 'suffix', 'full_name',
            'date_of_birth', 'age', 'gender', 'civil_status', 'contact_number', 'alternate_contact_number',
            'email', 'house_street', 'complete_address', 'address', 'province', 'city_municipality',
            'barangay', 'postal_code', 'relationship_to_borrower', 'employment_status', 'occupation',
            'employer_business_name', 'length_of_employment', 'monthly_income', 'other_income_source',
            'valid_id_type', 'valid_id_number', 'verification_status', 'review_notes', 'sort_order',
        ]), [
            'full_name' => $coMaker->displayName(),
            'date_of_birth' => $coMaker->date_of_birth?->format('Y-m-d'),
            'documents_by_category' => $docsByCategory,
        ]);
    }

    private function canAccessLoan(Request $request, Loan $loan): bool
    {
        $staffScope = app(StaffScopeService::class);

        return $staffScope->canAccessLoan($request->user(), $loan->assigned_officer_id, $loan->status);
    }

    private function belongsToLoan(Loan $loan, CoMaker $coMaker): bool
    {
        if ((int) $coMaker->loan_id === (int) $loan->id) {
            return true;
        }

        return $loan->loanApplication && (int) $coMaker->loan_application_id === (int) $loan->loanApplication->id;
    }
}
