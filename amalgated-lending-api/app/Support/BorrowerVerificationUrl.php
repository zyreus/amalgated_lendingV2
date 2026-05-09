<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\URL;

final class BorrowerVerificationUrl
{
    public static function signedVerifyUrl(User $user): string
    {
        $hours = max(1, min(720, (int) config('services.borrower_verify.expires_hours', 168)));
        $apiBase = rtrim((string) config('services.borrower_verify.base_url', config('app.url')), '/');
        $relative = URL::temporarySignedRoute(
            'api.borrower.email.verify',
            now()->addHours($hours),
            [
                'id' => $user->getKey(),
                'hash' => sha1((string) $user->getEmailForVerification()),
            ],
            false,
        );

        return $apiBase.$relative;
    }
}
