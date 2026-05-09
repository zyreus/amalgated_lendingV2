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
    /** Browser GET — signed URL completes verification and returns to SPA. */
    public function verify(Request $request): RedirectResponse|JsonResponse
    {
        /** @var User $user */
        $user = User::query()->findOrFail((int) $request->query('id'));

        if (! hash_equals((string) $request->query('hash'), sha1((string) $user->getEmailForVerification()))) {
            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Invalid or tampered verification token.',
                ], 403);
            }

            abort(403, 'Invalid verification link.');
        }

        if (! $user->hasVerifiedEmail()) {
            $user->markEmailAsVerified();
        }

        EmailVerificationLog::query()->create([
            'user_id' => $user->id,
            'event' => 'verified',
            'ip_address' => $request->ip(),
            'detail' => null,
        ]);

        $target = rtrim((string) config('app.frontend_url'), '/').'/borrower/dashboard?email_verified=1';

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

        SendBorrowerEmailVerificationJob::dispatch($user->id);

        return response()->json([
            'ok' => true,
            'message' => 'Verification email queued. Check your inbox shortly.',
        ]);
    }
}
