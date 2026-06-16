<?php

namespace App\Services;

use InvalidArgumentException;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SignatureStorageService
{
    private const MAX_SIGNATURE_BYTES = 1024 * 1024;

    /**
     * Decode a data-URL or raw base64 PNG payload and store on the public disk.
     *
     * @return string Relative path (e.g. signatures/abc.png)
     */
    public function storeBase64Png(string $dataUrlOrBase64, string $directory = 'signatures'): string
    {
        if (str_starts_with($dataUrlOrBase64, 'data:') && ! str_starts_with($dataUrlOrBase64, 'data:image/png;base64,')) {
            throw new InvalidArgumentException('Signature must be a PNG image.');
        }

        $raw = preg_replace('#^data:image/png;base64,#i', '', $dataUrlOrBase64);
        $binary = base64_decode($raw, true);
        if ($binary === false || $binary === '') {
            throw new InvalidArgumentException('Invalid base64 signature payload.');
        }
        if (strlen($binary) > self::MAX_SIGNATURE_BYTES) {
            throw new InvalidArgumentException('Signature image is too large.');
        }

        $imageInfo = getimagesizefromstring($binary);
        if (($imageInfo['mime'] ?? null) !== 'image/png') {
            throw new InvalidArgumentException('Signature must be a valid PNG image.');
        }

        $path = trim($directory, '/').'/'.Str::uuid()->toString().'.png';
        Storage::disk('public')->put($path, $binary);

        return $path;
    }
}
