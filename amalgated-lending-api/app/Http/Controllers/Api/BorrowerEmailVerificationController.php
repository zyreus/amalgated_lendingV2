<?php



namespace App\Http\Controllers\Api;



use App\Http\Controllers\Controller;

use App\Jobs\SendBorrowerEmailVerificationJob;

use App\Models\User;

use App\Services\BorrowerEmailVerificationService;

use App\Support\BorrowerVerificationUrl;

use Illuminate\Http\JsonResponse;

use Illuminate\Http\Request;

use Illuminate\Http\Response;

use Illuminate\Support\Facades\Cache;

use Symfony\Component\HttpFoundation\Response as SymfonyResponse;



/**

 * JSON + HTML verify for SPA/proxied clients. Inbox links should use web routes on the public host.

 */

class BorrowerEmailVerificationController extends Controller

{

    public function __construct(

        private readonly BorrowerEmailVerificationService $verification,

    ) {}



    public function verify(Request $request, ?int $id = null, ?string $hash = null): Response|JsonResponse

    {

        $resolvedId = $id ?? (int) $request->query('id');

        $resolvedHash = $hash ?? trim((string) $request->query('hash'));



        if ($resolvedId <= 0 || $resolvedHash === '') {

            return $this->render($request, [

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



        return $this->render($request, $this->verification->verify($request, $resolvedId, $resolvedHash));

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

    private function render(Request $request, array $result): Response|JsonResponse

    {

        if ($request->expectsJson()) {

            return response()->json([

                'ok' => $result['ok'],

                'message' => $result['message'],

                'status' => $result['status'],

                'login_url' => BorrowerVerificationUrl::borrowerLoginUrl($request, $result['login_params']),

            ], $result['http_status']);

        }



        $loginUrl = BorrowerVerificationUrl::borrowerLoginUrl($request, $result['login_params']);

        $status = $result['http_status'] >= 400 ? $result['http_status'] : SymfonyResponse::HTTP_OK;



        return response()

            ->view('borrower.auth.verify-email', [

                'ok' => $result['ok'],

                'title' => $result['title'],

                'message' => $result['message'],

                'status' => $result['status'],

                'loginUrl' => $loginUrl,
                'logoUrl' => \App\Support\MailLogo::pageLogoUrl(),
                'redirectSeconds' => $result['ok'] ? 6 : 0,

            ], $status)

            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    }

}


