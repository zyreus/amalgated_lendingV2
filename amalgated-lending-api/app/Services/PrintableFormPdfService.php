<?php

namespace App\Services;

use App\Models\PrintableForm;
use App\Models\User;
use Dompdf\Dompdf;
use Dompdf\Options;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;

class PrintableFormPdfService
{
    public function __construct()
    {
        $this->ensureStorageTrees();
    }

    public function ensureStorageTrees(): void
    {
        $public = storage_path('app/public');
        foreach (['forms', 'generated_pdfs'] as $dir) {
            File::ensureDirectoryExists($public.'/'.$dir);
        }
        File::ensureDirectoryExists(storage_path('app/private/master_templates'));
    }

    /**
     * @param  array<string, mixed>  $fieldData
     * @return array{0: string, 1: string} binary, storage path relative to public disk
     */
    public function makePdf(PrintableForm $form, array $fieldData, ?User $user, bool $watermark): array
    {
        $view = $form->bladeView();
        $data = $this->composeViewData($form, $fieldData, $user, $watermark);

        $html = View::make($view, $data)->render();

        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [public_path(), storage_path('app/public')]);

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html, 'UTF-8');
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        $binary = $dompdf->output();

        $filename = 'generated_pdfs/'.Str::uuid().'_'.$form->form_key.'.pdf';
        Storage::disk('public')->put($filename, $binary);

        return [$binary, $filename];
    }

    /**
     * @param  array<string, mixed>  $fieldData
     * @return array<string, mixed>
     */
    public function composeViewData(PrintableForm $form, array $fieldData, ?User $user, bool $watermark): array
    {
        $today = now()->format('Y-m-d');

        return [
            'form' => $form,
            'fields' => $fieldData,
            'borrower' => $user,
            'generatedAt' => $today,
            'branchLabel' => $form->branch ?: ($fieldData['branch'] ?? '___________________'),
            'watermark' => $watermark || $form->watermark_enabled,
            'logoDataUri' => $this->logoDataUri(),
            'company' => [
                'name' => config('app.name', 'Amalgated Lending Inc.'),
            ],
        ];
    }

    public function logoDataUri(): ?string
    {
        $p = public_path('amalgated-lending-logo.svg');
        if (! is_readable($p)) {
            return null;
        }
        $raw = @file_get_contents($p);
        if ($raw === false || $raw === '') {
            return null;
        }

        return 'data:image/svg+xml;charset=utf-8,'.rawurlencode($raw);
    }

    /** Default merge fields from borrower profile */
    public function borrowerDefaults(?User $user): array
    {
        if (! $user) {
            return [];
        }

        return [
            'full_name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone ?? '',
            'date' => now()->format('Y-m-d'),
        ];
    }
}
