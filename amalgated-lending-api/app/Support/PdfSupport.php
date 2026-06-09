<?php

namespace App\Support;

use Dompdf\Options;

class PdfSupport
{
    public static function hasGd(): bool
    {
        return extension_loaded('gd');
    }

    public static function canEmbedImages(): bool
    {
        return self::hasGd();
    }

    public static function logoDataUri(): ?string
    {
        $candidates = [
            public_path('amalgated-lending-logo.png'),
            base_path('../frontend/src/assets/amalgated-lending-logo.png'),
            base_path('../frontend/public/amalgated-lending-logo.png'),
        ];

        foreach ($candidates as $path) {
            if (! is_readable($path)) {
                continue;
            }
            $bytes = @file_get_contents($path);
            if (is_string($bytes) && $bytes !== '') {
                return 'data:image/png;base64,'.base64_encode($bytes);
            }
        }

        return null;
    }

    public static function dompdfOptions(): Options
    {
        $options = new Options;
        $options->set('isRemoteEnabled', true);
        $options->set('defaultFont', 'DejaVu Sans');
        $options->set('chroot', [public_path(), storage_path('app/public')]);

        return $options;
    }

    public static function gdInstallHint(): string
    {
        $ini = php_ini_loaded_file() ?: 'php.ini';

        return 'Enable the PHP GD extension in '.$ini.' (uncomment `extension=gd`), then restart the Laravel API '
            .'(npm run pm2:restart -- amalgated-backend). Until then, PDFs use a text-only letterhead.';
    }
}
