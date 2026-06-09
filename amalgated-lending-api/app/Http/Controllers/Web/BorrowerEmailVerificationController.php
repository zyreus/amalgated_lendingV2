<?php

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Services\BorrowerEmailVerificationService;
use App\Support\BorrowerVerificationUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class BorrowerEmailVerificationController extends Controller
{
    public function __construct(
        private readonly BorrowerEmailVerificationService $verification,
    ) {}

    /** Shown when borrowers need to verify before using the portal (bookmarkable info page). */
    public function notice(Request $request): Response
    {
        return $this->htmlResponse($request, [
            'ok' => false,
            'title' => 'Verify your email',
            'message' => 'Check your inbox for the verification link we sent when you registered. Links expire after '
                .(int) config('services.borrower_verify.expires_hours', 168).' hours.',
            'status' => 'notice',
            'http_status' => 200,
            'login_params' => [],
        ]);
    }

    /**
     * Canonical signed route: /borrower/email/verify/{id}/{hash}?expires=&signature=
     */
    public function verify(Request $request, int $id, string $hash): Response|RedirectResponse|JsonResponse
    {
        Log::debug('borrower.email.verify.hit', [
            'id' => $id,
            'path' => $request->path(),
            'expects_json' => $request->expectsJson(),
        ]);

        return $this->respond($request, $this->verification->verify($request, $id, $hash));
    }

    /**
     * Legacy emails used query params on /borrower/email/verify — redirect to path form when possible.
     */
    public function verifyLegacyQuery(Request $request): Response|RedirectResponse|JsonResponse
    {
        $id = (int) $request->query('id');
        $hash = trim((string) $request->query('hash'));

        if ($id <= 0 || $hash === '') {
            return $this->respond($request, [
                'ok' => false,
                'title' => 'Invalid link',
                'message' => 'This verification link is incomplete. Sign in and request a new verification email.',
                'status' => 'invalid',
                'http_status' => 400,
                'login_params' => [
                    'verification_status' => 'invalid',
                    'verification_message' => 'Incomplete verification link.',
                ],
            ]);
        }

        if ($request->hasValidSignature(false)) {
            $query = http_build_query(array_filter([
                'expires' => $request->query('expires'),
                'signature' => $request->query('signature'),
            ]));

            $target = url("/borrower/email/verify/{$id}/{$hash}").($query !== '' ? '?'.$query : '');

            Log::debug('borrower.email.verify.legacy_redirect', ['target' => $target]);

            return redirect()->to($target);
        }

        return $this->respond($request, $this->verification->verify($request, $id, $hash));
    }

    /**
     * @param  array{
     *   ok: bool,
     *   title: string,
     *   message: string,
     *   status: string,
     *   http_status: int,
     *   login_params: array<string, string>
     * }  $result
     */
    private function respond(Request $request, array $result): Response|RedirectResponse|JsonResponse
    {
        if ($request->expectsJson()) {
            return response()->json([
                'ok' => $result['ok'],
                'message' => $result['message'],
                'status' => $result['status'],
                'login_url' => BorrowerVerificationUrl::borrowerLoginUrl($request, $result['login_params']),
            ], $result['http_status']);
        }

        return $this->htmlResponse($request, $result);
    }

    /**
     * @param  array{
     *   ok: bool,
     *   title: string,
     *   message: string,
     *   status: string,
     *   http_status: int,
     *   login_params: array<string, string>
     * }  $result
     */
    private function htmlResponse(Request $request, array $result): Response
    {
        $loginUrl = BorrowerVerificationUrl::borrowerLoginUrl($request, $result['login_params']);

        return response()
            ->view('borrower.auth.verify-email', [
                'ok' => $result['ok'],
                'title' => $result['title'],
                'message' => $result['message'],
                'status' => $result['status'],
                'loginUrl' => $loginUrl,
                'logoUrl' => \App\Support\MailLogo::pageLogoUrl(),
                'redirectSeconds' => $result['ok'] ? 6 : 0,
            ], $result['http_status'] >= 400 ? $result['http_status'] : SymfonyResponse::HTTP_OK)
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
            ->header('Pragma', 'no-cache');
    }
}
