<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrintableForm;
use App\Models\PrintableFormLog;
use App\Services\PrintableFormPdfService;
use App\Support\PublicStorageUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PrintableFormAdminController extends Controller
{
    public function __construct(
        private readonly PrintableFormPdfService $pdfService
    ) {}

    public function index(Request $request): JsonResponse
    {
        $q = PrintableForm::query()->with('creator:id,name');

        if ($search = trim((string) $request->query('search', ''))) {
            $q->where(function ($w) use ($search) {
                $w->where('title', 'like', '%'.$search.'%')
                    ->orWhere('form_key', 'like', '%'.$search.'%');
            });
        }
        if ($cat = trim((string) $request->query('category', ''))) {
            $q->where('category', $cat);
        }
        if (($branch = $request->query('branch')) !== null && $branch !== '') {
            $q->where(function ($w) use ($branch) {
                $w->whereNull('branch')->orWhere('branch', '')->orWhere('branch', $branch);
            });
        }
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        $forms = $q->orderBy('sort_order')->orderBy('title')->paginate((int) $request->query('per_page', 25));

        return response()->json(['ok' => true, 'data' => $forms]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'form_key' => 'required|string|max:64|regex:/^[a-z0-9_]+$/|unique:printable_forms,form_key',
            'title' => 'required|string|max:255',
            'category' => 'nullable|string|max:64',
            'branch' => 'nullable|string|max:128',
            'description' => 'nullable|string',
            'pdf_version' => 'nullable|string|max:32',
            'status' => 'nullable|in:active,inactive',
            'watermark_enabled' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0|max:65535',
        ]);

        $data['created_by'] = $request->user()?->id;
        $data['status'] = $data['status'] ?? PrintableForm::STATUS_ACTIVE;
        $data['category'] = $data['category'] ?? 'lending';
        $data['pdf_version'] = $data['pdf_version'] ?? '1.0.0';

        $form = PrintableForm::create($data);

        return response()->json($form->fresh()->load('creator:id,name'), 201);
    }

    public function update(Request $request, PrintableForm $printableForm): JsonResponse
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'category' => 'sometimes|nullable|string|max:64',
            'branch' => 'sometimes|nullable|string|max:128',
            'description' => 'sometimes|nullable|string',
            'pdf_version' => 'sometimes|nullable|string|max:32',
            'status' => 'sometimes|in:active,inactive',
            'watermark_enabled' => 'sometimes|boolean',
            'sort_order' => 'sometimes|integer|min:0|max:65535',
        ]);

        $printableForm->update($data);

        return response()->json($printableForm->fresh()->load('creator:id,name'));
    }

    public function destroy(PrintableForm $printableForm): JsonResponse
    {
        $printableForm->delete();

        return response()->json(['ok' => true]);
    }

    public function uploadTemplate(Request $request, PrintableForm $printableForm): JsonResponse
    {
        $request->validate([
            'template' => 'required|file|max:15360|mimes:pdf,doc,docx',
        ]);

        $path = $request->file('template')->store('private/master_templates', 'local');
        $printableForm->update(['template_file' => $path]);

        return response()->json([
            'message' => 'Template stored.',
            'template_file' => $path,
        ]);
    }

    public function testPdf(Request $request, PrintableForm $printableForm): Response
    {
        $validated = $request->validate([
            'fields' => 'sometimes|array',
            'watermark' => 'sometimes|boolean',
            'inline' => 'sometimes|boolean',
        ]);

        $fields = array_merge($this->pdfService->borrowerDefaults($request->user()), $validated['fields'] ?? []);
        $wm = (bool) ($validated['watermark'] ?? false);

        [$binary, $storagePath] = $this->pdfService->makePdf($printableForm, $fields, $request->user(), $wm);

        PrintableFormLog::create([
            'printable_form_id' => $printableForm->id,
            'user_id' => $request->user()?->id,
            'actor_type' => 'admin',
            'action' => 'previewed',
            'storage_path' => $storagePath,
            'ip_address' => $request->ip(),
            'user_agent' => substr((string) $request->userAgent(), 0, 512),
            'meta' => ['test' => true],
            'generated_at' => now(),
        ]);

        $inline = (bool) ($validated['inline'] ?? false);
        $filename = str_replace('_', '-', $printableForm->form_key).'-test.pdf';

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => ($inline ? 'inline' : 'attachment').'; filename="'.$filename.'"',
        ]);
    }

    public function logs(Request $request): JsonResponse
    {
        $q = PrintableFormLog::query()->with(['printableForm:id,title,form_key', 'user:id,name,email']);

        if ($request->filled('form_id')) {
            $q->where('printable_form_id', (int) $request->query('form_id'));
        }
        if ($action = $request->query('action')) {
            $q->where('action', $action);
        }

        $logs = $q->orderByDesc('id')->paginate((int) $request->query('per_page', 40));

        $logs->getCollection()->transform(function (PrintableFormLog $log) {
            $path = $log->storage_path;

            return [
                'id' => $log->id,
                'printable_form_id' => $log->printable_form_id,
                'form' => $log->printableForm,
                'user' => $log->user,
                'actor_type' => $log->actor_type,
                'action' => $log->action,
                'storage_path' => $path,
                'download_url' => PublicStorageUrl::apiUrl($path),
                'ip_address' => $log->ip_address,
                'generated_at' => $log->generated_at,
                'downloaded_at' => $log->downloaded_at,
                'created_at' => $log->created_at,
            ];
        });

        return response()->json(['ok' => true, 'data' => $logs]);
    }

    /** Serve master template binary for admin preview (private disk). */
    public function downloadMasterTemplate(Request $request, PrintableForm $printableForm): Response
    {
        $rel = $printableForm->template_file;
        if (! $rel || ! Storage::disk('local')->exists($rel)) {
            abort(404, 'No template file uploaded.');
        }

        return Storage::disk('local')->download($rel);
    }
}
