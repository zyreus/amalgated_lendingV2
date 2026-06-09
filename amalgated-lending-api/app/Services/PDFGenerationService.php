<?php

namespace App\Services;

use App\Models\SoaStatement;
use App\Support\PdfSupport;
use Dompdf\Dompdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;

class PDFGenerationService
{
    public function ensureSoaPdf(SoaStatement $statement): string
    {
        $statement->loadMissing(['borrower', 'loan.payments']);
        $path = $statement->pdf_path ?: $this->buildPath($statement);

        if ($statement->pdf_path && Storage::disk('public')->exists($statement->pdf_path)) {
            return $statement->pdf_path;
        }

        try {
            $pdfBytes = $this->renderSoaPdfBytes($statement, PdfSupport::canEmbedImages());
        } catch (\Throwable $e) {
            if (PdfSupport::canEmbedImages() && stripos($e->getMessage(), 'GD') !== false) {
                $pdfBytes = $this->renderSoaPdfBytes($statement, false);
            } else {
                throw $e;
            }
        }

        Storage::disk('public')->put($path, $pdfBytes);
        $statement->forceFill(['pdf_path' => $path])->save();

        return $path;
    }

    private function renderSoaPdfBytes(SoaStatement $statement, bool $useImageLogo): string
    {
        $html = View::make('pdf.soa-statement', [
            'statement' => $statement,
            'borrower' => $statement->borrower,
            'loan' => $statement->loan,
            'payments' => collect($statement->snapshot['payment_history'] ?? []),
            'companyName' => config('app.name', 'Amalgated Lending Inc.'),
            'generatedAt' => now()->format('F j, Y g:i A'),
            'logoDataUri' => $useImageLogo ? PdfSupport::logoDataUri() : null,
            'useImageLogo' => $useImageLogo,
        ])->render();

        $dompdf = new Dompdf(PdfSupport::dompdfOptions());
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return (string) $dompdf->output();
    }

    private function buildPath(SoaStatement $statement): string
    {
        $month = $statement->statement_month?->format('Y-m') ?? now()->format('Y-m');

        return sprintf('soa-statements/%s/soa-%s-%s.pdf', $month, $statement->loan_id, $statement->id ?: 'new');
    }

}
