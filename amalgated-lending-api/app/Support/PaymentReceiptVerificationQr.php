<?php

namespace App\Support;

use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;

final class PaymentReceiptVerificationQr
{
    public static function dataUri(string $payload): ?string
    {
        if (! extension_loaded('gd')) {
            return null;
        }
        if (strlen($payload) > 900) {
            $payload = substr($payload, 0, 900);
        }
        try {
            $opts = new QROptions([
                'outputType' => QRCode::OUTPUT_IMAGE_PNG,
                'scale' => 3,
                'outputBase64' => true,
            ]);
            $out = (new QRCode($opts))->render($payload);
            if (! is_string($out) || $out === '') {
                return null;
            }
            if (str_starts_with($out, 'data:')) {
                return $out;
            }

            return 'data:image/png;base64,'.base64_encode($out);
        } catch (\Throwable) {
            return null;
        }
    }
}
