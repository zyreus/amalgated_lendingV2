<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Models\SoaStatement;
use App\Services\PDFGenerationService;
use App\Services\SOAService;
use App\Support\SoaStatementUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class SoaStatementDownloadController extends Controller
{
    public function __construct(
        private readonly PDFGenerationService $pdfs,
        private readonly SOAService $soaService,
    ) {}

    /**
     * Signed download from SOA email — no borrower session required.
     */
    public function download(Request $request, SoaStatement $statement, string $hash): Response
    {
        if (! hash_equals(SoaStatementUrl::borrowerHash($statement), $hash)) {
            abort(403, 'Invalid statement link.');
        }

        $path = $this->pdfs->ensureSoaPdf($statement);
        $this->soaService->markViewed($statement);
        $this->soaService->markDownloaded($statement);

        $filename = 'SOA-'.$statement->statement_month?->format('Y-m').'-'.$statement->id.'.pdf';

        return response(Storage::disk('public')->get($path), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
            'Cache-Control' => 'private, max-age=0, must-revalidate',
        ]);
    }
}
