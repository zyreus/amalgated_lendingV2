<?php

namespace App\Services;

use App\Models\DocumentLoanApplication;
use App\Models\DocumentUploadHistory;
use App\Models\Loan;
use App\Models\LoanApplication;
use App\Models\Payment;
use App\Models\UploadedDocument;
use App\Models\User;
use App\Support\PublicStorageUrl;
use Illuminate\Support\Collection;

/**
 * Aggregates borrower-facing uploads for admin CRM (single round-trip, lean selects).
 */
final class BorrowerUploadedFilesManifest
{
    public static function build(User $borrower): array
    {
        $sections = [];

        $borrower->loadMissing([]);

        $portalItems = self::portalSectionItems($borrower);
        if ($portalItems !== []) {
            $sections[] = [
                'section_key' => 'portal_profile',
                'title' => 'Portal profile & government ID',
                'subtitle' => 'KYC from borrower account / profile.',
                'items' => $portalItems,
            ];
        }

        $apps = DocumentLoanApplication::query()
            ->where('user_id', $borrower->id)
            ->select(['id', 'user_id', 'loan_product_id', 'status', 'submitted_at', 'valid_id_path', 'proof_income_path', 'additional_document_paths', 'signed_form_path', 'is_signed', 'created_at', 'updated_at'])
            ->with(['loanProduct:id,name'])
            ->with([
                'uploadedDocuments' => function ($q) {
                    $q->select(['id', 'document_loan_application_id', 'loan_requirement_id', 'file_path', 'original_name', 'status', 'remarks', 'version', 'created_at', 'updated_at'])
                        ->with(['loanRequirement:id,requirement_name']);
                },
            ])
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        $uploadIds = $apps->flatMap(fn (DocumentLoanApplication $a) => $a->uploadedDocuments->pluck('id'))->unique()->values();
        $histByUploadId = collect();
        if ($uploadIds->isNotEmpty()) {
            $histByUploadId = DocumentUploadHistory::query()
                ->whereIn('uploaded_document_id', $uploadIds->all())
                ->orderByDesc('version')
                ->get()
                ->groupBy('uploaded_document_id')
                ->map(fn ($rows) => $rows->take(12)->values());
        }
        foreach ($apps as $app) {
            foreach ($app->uploadedDocuments as $u) {
                $u->setRelation('histories', $histByUploadId->get($u->id, collect()));
            }
        }

        foreach ($apps as $app) {
            $sec = self::documentLoanSection($app);
            if ($sec['items'] !== []) {
                $sections[] = $sec;
            }
        }

        $loanApps = LoanApplication::query()
            ->where('user_id', $borrower->id)
            ->select(['id', 'applicant_signature', 'spouse_signature', 'comaker_signature', 'updated_at'])
            ->orderByDesc('id')
            ->limit(30)
            ->get();

        $sigItems = self::signatureItems($loanApps);
        if ($sigItems !== []) {
            $sections[] = [
                'section_key' => 'loan_application_signatures',
                'title' => 'Application signatures',
                'subtitle' => 'Captured on general / wizard loan applications.',
                'items' => $sigItems,
            ];
        }

        $loans = Loan::query()
            ->where('borrower_id', $borrower->id)
            ->select(['id', 'face_photo_path', 'face_capture_at', 'kyc_documents', 'created_at'])
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        foreach ($loans as $loan) {
            $sec = self::loanKycSection($loan);
            if ($sec['items'] === []) {
                continue;
            }
            $sections[] = $sec;
        }

        $payments = Payment::query()
            ->whereHas('loan', fn ($q) => $q->where('borrower_id', $borrower->id))
            ->select(['id', 'loan_id', 'installment_no', 'receipt_path', 'receipt_name', 'invoice_pdf_path', 'status', 'paid_at', 'submitted_at', 'updated_at', 'notes'])
            ->with(['paymentReceipts' => fn ($q) => $q->select(['id', 'payment_id', 'receipt_number', 'pdf_path', 'created_at'])->orderByDesc('id')->limit(5)])
            ->orderByDesc('id')
            ->limit(80)
            ->get();

        $paySection = self::paymentProofsSection($payments);
        if ($paySection['items'] !== []) {
            $sections[] = $paySection;
        }

        return [
            'summary' => self::summarizeSections($sections),
            'sections' => $sections,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $sections
     * @return array{total_files: int, pending_review: int}
     */
    private static function summarizeSections(array $sections): array
    {
        $total = 0;
        $pending = 0;
        foreach ($sections as $section) {
            foreach ($section['items'] ?? [] as $it) {
                $total++;
                if (! empty($it['uploaded_document_id']) && ($it['review_status'] ?? '') === 'pending') {
                    $pending++;
                }
            }
        }

        return [
            'total_files' => $total,
            'pending_review' => $pending,
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function portalSectionItems(User $borrower): array
    {
        $items = [];
        if ($borrower->profile_photo_path) {
            $items[] = self::fileItem(
                id: 'portal-profile-photo',
                category: 'Profile photo',
                path: $borrower->profile_photo_path,
                originalName: $borrower->profile_photo_name,
                reviewStatus: null,
                remarks: null,
                uploadedAt: null,
                uploadedDocumentId: null,
                histories: [],
                meta: ['source_table' => 'users', 'source_column' => 'profile_photo_path'],
            );
        }
        if ($borrower->id_document_path) {
            $items[] = self::fileItem(
                id: 'portal-id-document',
                category: 'Valid ID (portal)',
                path: $borrower->id_document_path,
                originalName: $borrower->id_document_name,
                reviewStatus: null,
                remarks: null,
                uploadedAt: null,
                uploadedDocumentId: null,
                histories: [],
                meta: ['source_table' => 'users', 'source_column' => 'id_document_path'],
            );
        }

        return $items;
    }

    /**
     * @param  Collection<int, LoanApplication>  $loanApps
     * @return list<array<string, mixed>>
     */
    private static function signatureItems(Collection $loanApps): array
    {
        $items = [];
        foreach ($loanApps as $la) {
            foreach (['applicant_signature' => 'Applicant signature', 'spouse_signature' => 'Spouse signature', 'comaker_signature' => 'Co-maker signature'] as $col => $label) {
                $path = $la->{$col} ?? null;
                if (! $path) {
                    continue;
                }
                $items[] = self::fileItem(
                    id: 'loan-app-'.$la->id.'-'.$col,
                    category: $label,
                    path: $path,
                    originalName: basename((string) $path),
                    reviewStatus: null,
                    remarks: null,
                    uploadedAt: optional($la->updated_at)?->toIso8601String(),
                    uploadedDocumentId: null,
                    histories: [],
                    meta: ['loan_application_id' => $la->id, 'source_column' => $col],
                );
            }
        }

        return $items;
    }

    /**
     * @return array{section_key: string, title: string, subtitle: string|null, application_id: int|null, application_status: string|null, submitted_at: string|null, items: list<array<string, mixed>>}
     */
    private static function documentLoanSection(DocumentLoanApplication $app): array
    {
        $productName = $app->loanProduct?->name ?? 'Loan product';
        $items = [];

        if ($app->signed_form_path) {
            $items[] = self::fileItem(
                id: 'docloan-'.$app->id.'-signed-form',
                category: 'Signed application form',
                path: $app->signed_form_path,
                originalName: basename($app->signed_form_path),
                reviewStatus: $app->is_signed ? 'approved' : 'pending',
                remarks: null,
                uploadedAt: optional($app->updated_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['document_loan_application_id' => $app->id, 'slot' => 'signed_form'],
            );
        }
        if ($app->valid_id_path) {
            $items[] = self::fileItem(
                id: 'docloan-'.$app->id.'-valid-id',
                category: 'Valid ID (wizard)',
                path: $app->valid_id_path,
                originalName: basename($app->valid_id_path),
                reviewStatus: null,
                remarks: null,
                uploadedAt: optional($app->updated_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['document_loan_application_id' => $app->id, 'slot' => 'valid_id'],
            );
        }
        if ($app->proof_income_path) {
            $items[] = self::fileItem(
                id: 'docloan-'.$app->id.'-payslip',
                category: 'Proof of income / payslip',
                path: $app->proof_income_path,
                originalName: basename($app->proof_income_path),
                reviewStatus: null,
                remarks: null,
                uploadedAt: optional($app->updated_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['document_loan_application_id' => $app->id, 'slot' => 'proof_income'],
            );
        }
        foreach ($app->additional_document_paths ?? [] as $idx => $p) {
            if (! $p) {
                continue;
            }
            $items[] = self::fileItem(
                id: 'docloan-'.$app->id.'-additional-'.$idx,
                category: 'Supporting document #'.($idx + 1),
                path: $p,
                originalName: basename((string) $p),
                reviewStatus: null,
                remarks: null,
                uploadedAt: optional($app->updated_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['document_loan_application_id' => $app->id, 'slot' => 'additional', 'index' => $idx],
            );
        }

        foreach ($app->uploadedDocuments as $u) {
            $items[] = self::uploadedDocumentRow($u, $app);
        }

        return [
            'section_key' => 'document_loan_'.$app->id,
            'title' => 'Document loan application #'.$app->id.' — '.$productName,
            'subtitle' => 'Submitted: '.($app->submitted_at ? $app->submitted_at->toIso8601String() : 'Draft'),
            'application_id' => $app->id,
            'application_status' => $app->status,
            'submitted_at' => optional($app->submitted_at)?->toIso8601String(),
            'items' => $items,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function uploadedDocumentRow(UploadedDocument $u, DocumentLoanApplication $app): array
    {
        $hist = $u->getRelation('histories') ?? collect();

        $historyPayload = $hist->map(fn ($h) => [
            'version' => (int) $h->version,
            'file_path' => $h->file_path,
            'original_name' => $h->original_name,
            'preview_url' => $h->file_path ? PublicStorageUrl::apiUrl($h->file_path) : null,
            'mime_kind' => self::mimeKind($h->original_name, $h->file_path),
        ])->values()->all();

        $reqName = $u->loanRequirement?->requirement_name ?? 'Loan requirement';

        return self::fileItem(
            id: 'uploaded-doc-'.$u->id,
            category: $reqName,
            path: $u->file_path,
            originalName: $u->original_name,
            reviewStatus: self::normalizeReviewStatus($u->status),
            remarks: $u->remarks,
            uploadedAt: optional($u->updated_at)?->toIso8601String(),
            uploadedDocumentId: $u->id,
            histories: $historyPayload,
            meta: [
                'document_loan_application_id' => $app->id,
                'loan_requirement_id' => $u->loan_requirement_id,
                'version' => (int) $u->version,
            ],
        );
    }

    /**
     * @return array{section_key: string, title: string, subtitle: string|null, application_id: null, application_status: null, submitted_at: null, items: list<array<string, mixed>>}
     */
    private static function loanKycSection(Loan $loan): array
    {
        $items = [];
        if ($loan->face_photo_path) {
            $items[] = self::fileItem(
                id: 'loan-'.$loan->id.'-face',
                category: 'Selfie / face capture',
                path: $loan->face_photo_path,
                originalName: basename($loan->face_photo_path),
                reviewStatus: null,
                remarks: null,
                uploadedAt: optional($loan->face_capture_at ?? $loan->created_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['loan_id' => $loan->id, 'slot' => 'face_photo'],
            );
        }
        foreach ($loan->kyc_documents ?? [] as $idx => $doc) {
            if (! is_array($doc)) {
                continue;
            }
            $path = $doc['path'] ?? null;
            if (! $path) {
                continue;
            }
            $items[] = self::fileItem(
                id: 'loan-'.$loan->id.'-kyc-'.$idx,
                category: (string) ($doc['label'] ?? 'KYC document'),
                path: $path,
                originalName: $doc['original_name'] ?? basename((string) $path),
                reviewStatus: null,
                remarks: null,
                uploadedAt: optional($loan->created_at)?->toIso8601String(),
                uploadedDocumentId: null,
                histories: [],
                meta: ['loan_id' => $loan->id, 'kyc_index' => $idx],
            );
        }

        return [
            'section_key' => 'loan_kyc_'.$loan->id,
            'title' => 'Loan #'.$loan->id.' — identity & KYC',
            'subtitle' => null,
            'application_id' => null,
            'application_status' => null,
            'submitted_at' => null,
            'items' => $items,
        ];
    }

    /**
     * @param  Collection<int, Payment>  $payments
     * @return array{section_key: string, title: string, subtitle: string|null, application_id: null, application_status: null, submitted_at: null, items: list<array<string, mixed>>}
     */
    private static function paymentProofsSection(Collection $payments): array
    {
        $items = [];
        foreach ($payments as $pay) {
            if ($pay->receipt_path) {
                $items[] = self::fileItem(
                    id: 'payment-'.$pay->id.'-receipt',
                    category: 'Payment proof — installment #'.(int) $pay->installment_no,
                    path: $pay->receipt_path,
                    originalName: $pay->receipt_name ?: basename($pay->receipt_path),
                    reviewStatus: null,
                    remarks: $pay->notes,
                    uploadedAt: optional($pay->submitted_at ?? $pay->paid_at ?? $pay->updated_at)?->toIso8601String(),
                    uploadedDocumentId: null,
                    histories: [],
                    meta: ['payment_id' => $pay->id, 'loan_id' => $pay->loan_id, 'kind' => 'borrower_receipt'],
                );
            }
            if ($pay->invoice_pdf_path) {
                $items[] = self::fileItem(
                    id: 'payment-'.$pay->id.'-invoice',
                    category: 'Invoice PDF — installment #'.(int) $pay->installment_no,
                    path: $pay->invoice_pdf_path,
                    originalName: basename($pay->invoice_pdf_path),
                    reviewStatus: null,
                    remarks: null,
                    uploadedAt: optional($pay->updated_at)?->toIso8601String(),
                    uploadedDocumentId: null,
                    histories: [],
                    meta: ['payment_id' => $pay->id, 'loan_id' => $pay->loan_id, 'kind' => 'invoice'],
                );
            }
            foreach ($pay->paymentReceipts as $pr) {
                if (! $pr->pdf_path) {
                    continue;
                }
                $items[] = self::fileItem(
                    id: 'payment-receipt-'.$pr->id,
                    category: 'Official receipt '.($pr->receipt_number ? '#'.$pr->receipt_number : ''),
                    path: $pr->pdf_path,
                    originalName: basename($pr->pdf_path),
                    reviewStatus: null,
                    remarks: null,
                    uploadedAt: optional($pr->created_at)?->toIso8601String(),
                    uploadedDocumentId: null,
                    histories: [],
                    meta: ['payment_id' => $pay->id, 'payment_receipt_id' => $pr->id, 'loan_id' => $pay->loan_id],
                );
            }
        }

        return [
            'section_key' => 'payment_proofs',
            'title' => 'Payment proofs & receipts',
            'subtitle' => 'Borrower-submitted receipts and system-generated invoices.',
            'application_id' => null,
            'application_status' => null,
            'submitted_at' => null,
            'items' => $items,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $histories
     * @param  array<string, mixed>  $meta
     * @return array<string, mixed>
     */
    private static function fileItem(
        string $id,
        string $category,
        string $path,
        ?string $originalName,
        ?string $reviewStatus,
        ?string $remarks,
        ?string $uploadedAt,
        ?int $uploadedDocumentId,
        array $histories,
        array $meta,
    ): array {
        $url = PublicStorageUrl::apiUrl($path);

        return [
            'id' => $id,
            'category' => $category,
            'file_path' => $path,
            'original_name' => $originalName,
            'preview_url' => $url,
            'download_url' => $url,
            'mime_kind' => self::mimeKind($originalName, $path),
            'review_status' => $reviewStatus,
            'remarks' => $remarks,
            'uploaded_at' => $uploadedAt,
            'uploaded_document_id' => $uploadedDocumentId,
            'reupload_history' => $histories,
            'meta' => $meta,
        ];
    }

    private static function mimeKind(?string $name, ?string $path): string
    {
        $ext = strtolower((string) pathinfo((string) ($name ?: $path), PATHINFO_EXTENSION));

        return match ($ext) {
            'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp' => 'image',
            'pdf' => 'pdf',
            default => 'file',
        };
    }

    private static function normalizeReviewStatus(?string $status): ?string
    {
        if ($status === null || $status === '') {
            return null;
        }

        return $status === UploadedDocument::STATUS_VERIFIED ? 'approved' : $status;
    }
}
