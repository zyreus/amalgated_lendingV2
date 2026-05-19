<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendBorrowerEmailVerificationJob;
use App\Models\EmailVerificationLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class BorrowerEmailVerificationController extends Controller
{
    private function loginRedirectUrl(array $params = []): string
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        $path = '/'.ltrim((string) config('services.borrower_verify.login_path', '/borrower/login'), '/');
        $query = http_build_query(array_filter($params, static fn ($v) => $v !== null && $v !== ''));

        return $query !== '' ? "{$base}{$path}?{$query}" : "{$base}{$path}";
    }

    /** Browser GET — signed URL completes verification and returns to SPA. */
    public function verify(Request $request): RedirectResponse|JsonResponse
    {
        if (! $request->hasValidSignature(false)) {
            $isExpired = is_numeric($request->query('expires'))
                && (int) $request->query('expires') < now()->getTimestamp();
            $message = $isExpired
                ? 'This verification link expired. Please request a new email.'
                : 'This verification link is invalid.';
            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => $message,
                ], 403);
            }

            return redirect()->away($this->loginRedirectUrl([
                'verification_status' => $isExpired ? 'expired' : 'invalid',
                'verification_message' => $message,
            ]));
        }

        /** @var User $user */
        $user = User::query()->findOrFail((int) $request->query('id'));

        if (! hash_equals((string) $request->query('hash'), sha1((string) $user->getEmailForVerification()))) {
            $message = 'Invalid or tampered verification token.';
            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => $message,
                ], 403);
            }

            return redirect()->away($this->loginRedirectUrl([
                'verification_status' => 'invalid',
                'verification_message' => $message,
            ]));
        }

        $alreadyVerified = $user->hasVerifiedEmail();
        if (! $alreadyVerified) {
            $user->markEmailAsVerified();
            EmailVerificationLog::query()->create([
                'user_id' => $user->id,
                'event' => 'verified',
                'ip_address' => $request->ip(),
                'detail' => null,
            ]);
        }

        $target = $this->loginRedirectUrl([
            'verified' => '1',
            'verification_status' => $alreadyVerified ? 'already_verified' : 'success',
        ]);

        return redirect()->away($target);
    }

    public function resend(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->canUseBorrowerPortal()) {
            return response()->json(['ok' => false, 'message' => 'Only borrowers may request verification.'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['ok' => true, 'message' => 'Email is already verified.']);
        }

        if (Cache::get('borrower_verify_resend_attempt:'.$user->id)) {
            return response()->json([
                'ok' => false,
                'message' => 'Please wait a moment before requesting another email.',
            ], 429);
        }

        Cache::put('borrower_verify_resend_attempt:'.$user->id, true, now()->addSeconds((int) config('services.borrower_verify.resend_cooldown_seconds', 120)));

        SendBorrowerEmailVerificationJob::dispatchSync($user->id);

        return response()->json([
            'ok' => true,
            'message' => 'Verification email queued. Check your inbox shortly.',
        ]);
    }
}
