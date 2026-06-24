<?php

namespace App\Support;

use App\Models\SoaStatement;
use Illuminate\Support\Facades\URL;

final class SoaStatementUrl
{
    public static function borrowerHash(SoaStatement $statement): string
    {
        return sha1((int) $statement->borrower_id.':'.(int) $statement->id);
    }

    /**
     * Signed link for email/mobile — opens the SOA PDF without borrower login.
     */
    public static function signedPdfDownloadUrl(SoaStatement $statement, int $expiresDays = 45): string
    {
        $statement->loadMissing('borrower');
        $appUrl = rtrim((string) config('app.url'), '/');
        $base = BorrowerVerificationUrl::publicBaseUrlForEmail();

        URL::forceRootUrl($base);

        try {
            $relative = URL::temporarySignedRoute(
                'borrower.soa.download',
                now()->addDays(max(1, $expiresDays)),
                [
                    'statement' => $statement->id,
                    'hash' => self::borrowerHash($statement),
                ],
                false,
            );
        } finally {
            if ($appUrl !== '') {
                URL::forceRootUrl($appUrl);
            }
        }

        return $base.$relative;
    }

    public static function portalStatementsUrl(?int $statementId = null): string
    {
        $base = rtrim(BorrowerVerificationUrl::publicBaseUrlForEmail(), '/');
        $url = $base.'/borrower/statements';
        if ($statementId !== null && $statementId > 0) {
            $url .= '?soa='.$statementId;
        }

        return $url;
    }
}
