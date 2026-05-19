<?php

namespace App\Services;

use App\Models\EmailVerificationLog;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

final class BorrowerEmailVerificationService
{
    /**
     * @return array{
     *   ok: bool,
     *   title: string,
     *   message: string,
     *   status: string,
     *   http_status: int,
     *   login_params: array<string, string>
     * }
     */
    public function verify(Request $request, int $id, string $hash): array
    {
        if (! $request->hasValidSignature(false)) {
            $isExpired = is_numeric($request->query('expires'))
                && (int) $request->query('expires') < now()->getTimestamp();

            Log::info('borrower.email.verify.signature_invalid', [
                'id' => $id,
                'expired' => $isExpired,
                'ip' => $request->ip(),
            ]);

            $message = $isExpired
                ? 'This verification link expired. Please request a new email.'
                : 'This verification link is invalid.';

            return [
                'ok' => false,
                'title' => $isExpired ? 'Link expired' : 'Link invalid',
                'message' => $message,
                'status' => $isExpired ? 'expired' : 'invalid',
                'http_status' => 403,
                'login_params' => [
                    'verification_status' => $isExpired ? 'expired' : 'invalid',
                    'verification_message' => $message,
                ],
            ];
        }

        $user = User::query()->find($id);
        if (! $user) {
            Log::warning('borrower.email.verify.user_missing', ['id' => $id]);

            return [
                'ok' => false,
                'title' => 'Account not found',
                'message' => 'We could not find a borrower account for this link. Sign in or register again.',
                'status' => 'not_found',
                'http_status' => 404,
                'login_params' => [
                    'verification_status' => 'invalid',
                    'verification_message' => 'Account not found for this verification link.',
                ],
            ];
        }

        if (! $user->canUseBorrowerPortal()) {
            Log::warning('borrower.email.verify.not_borrower', ['user_id' => $user->id]);

            return [
                'ok' => false,
                'title' => 'Unauthorized',
                'message' => 'This link is not valid for a borrower portal account.',
                'status' => 'unauthorized',
                'http_status' => 403,
                'login_params' => [
                    'verification_status' => 'invalid',
                    'verification_message' => 'Not a borrower portal account.',
                ],
            ];
        }

        $expectedHash = sha1((string) $user->getEmailForVerification());
        if (! hash_equals($expectedHash, $hash)) {
            Log::warning('borrower.email.verify.hash_mismatch', ['user_id' => $user->id]);

            return [
                'ok' => false,
                'title' => 'Verification failed',
                'message' => 'Invalid or tampered verification token.',
                'status' => 'invalid',
                'http_status' => 403,
                'login_params' => [
                    'verification_status' => 'invalid',
                    'verification_message' => 'Invalid or tampered verification token.',
                ],
            ];
        }

        $alreadyVerified = $user->hasVerifiedEmail();
        if (! $alreadyVerified) {
            $user->markEmailAsVerified();
            try {
                EmailVerificationLog::query()->create([
                    'user_id' => $user->id,
                    'event' => 'verified',
                    'ip_address' => $request->ip(),
                    'detail' => null,
                ]);
            } catch (\Throwable $e) {
                Log::debug('borrower.email.verify.log_failed', ['error' => $e->getMessage()]);
            }
        }

        Log::info('borrower.email.verify.success', [
            'user_id' => $user->id,
            'already_verified' => $alreadyVerified,
        ]);

        $status = $alreadyVerified ? 'already_verified' : 'success';
        $message = $alreadyVerified
            ? 'This email address is already verified. You can sign in to your borrower account.'
            : 'Your email address is verified. You can now sign in to the borrower portal.';

        return [
            'ok' => true,
            'title' => $alreadyVerified ? 'Already verified' : 'Email verified',
            'message' => $message,
            'status' => $status,
            'http_status' => 200,
            'login_params' => [
                'verified' => '1',
                'verification_status' => $status,
            ],
        ];
    }
}
