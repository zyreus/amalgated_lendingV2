<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrintableForm;
use App\Models\PrintableFormLog;
use App\Services\PrintableFormPdfService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PrintableFormBorrowerController extends Controller
{
    public function __construct(
        private readonly PrintableFormPdfService $pdfService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $branchCode = trim((string) $request->query('branch_code', ''));

        $q = PrintableForm::query()
            ->where('status', PrintableForm::STATUS_ACTIVE)
            ->where(function ($w) use ($branchCode) {
                $w->whereNull('branch')->orWhere('branch', '');
                if ($branchCode !== '') {
                    $w->orWhere('branch', $branchCode);
                }
            })
            ->orderBy('sort_order')
            ->orderBy('title');

        $forms = $q->get([
            'id', 'form_key', 'title', 'category', 'branch', 'description', 'pdf_version', 'watermark_enabled', 'sort_order',
        ]);

        return response()->json(['data' => $forms]);
    }

    public function generate(Request $request, PrintableForm $printableForm): JsonResponse
    {
        if (! $this->borrowerCanAccess($printableForm, trim((string) $request->input('branch_code', '')))) {
            abort(403, 'This form is not available for your branch.');
        }

        $validated = Validator::make($request->all(), [
            'fields' => 'sometimes|array',
            'watermark' => 'sometimes|boolean',
            'branch_code' => 'sometimes|string|max:128',
        ])->validate();

        $fields = array_merge(
            $this->pdfService->borrowerDefaults($request->user()),
            $validated['fields'] ?? []
        );
        $wm = (bool) ($validated['watermark'] ?? false);

        [$binary, $storagePath] = $this->pdfService->makePdf($printableForm, $fields, $request->user(), $wm);

        PrintableFormLog::create([
            'printable_form_id' => $printableForm->id,
            'user_id' => $request->user()?->id,
            'actor_type' => 'borrower',
            'action' => 'generated',
            'storage_path' => $storagePath,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
            'meta' => ['bytes' => strlen($binary)],
            'generated_at' => now(),
        ]);

        return response()->json([
            'path' => $storagePath,
            'download_url' => PublicStorageUrl::apiUrl($storagePath),
            'form_id' => $printableForm->id,
            'title' => $printableForm->title,
        ]);
    }

    /** Mark audit trail when borrower opens a previously generated file (optional). */
    public function recordDownload(Request $request): JsonResponse
    {
        $data = $request->validate([
            'printable_form_id' => 'required|exists:printable_forms,id',
            'storage_path' => 'required|string|max:512',
        ]);

        PrintableFormLog::create([
            'printable_form_id' => (int) $data['printable_form_id'],
            'user_id' => $request->user()?->id,
            'actor_type' => 'borrower',
            'action' => 'downloaded',
            'storage_path' => $data['storage_path'],
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
            'downloaded_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    private function borrowerCanAccess(PrintableForm $form, string $branchCode): bool
    {
        if ($form->status !== PrintableForm::STATUS_ACTIVE) {
            return false;
        }

        $b = $form->branch;
        if ($b === null || $b === '') {
            return true;
        }

        return $branchCode !== '' && $b === $branchCode;
    }
}
