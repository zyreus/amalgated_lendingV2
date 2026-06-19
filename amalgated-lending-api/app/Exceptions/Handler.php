<?php

namespace App\Exceptions;

use App\Support\BorrowerVerificationUrl;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Psr\Log\LogLevel;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of exception types with their corresponding custom log levels.
     *
     * @var array<class-string<Throwable>, LogLevel::*>
     */
    protected $levels = [
        //
    ];

    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<Throwable>>
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed to the session on validation exceptions.
     *
     * @var array<int, string>
     */
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            //
        });

        $this->renderable(function (ThrottleRequestsException $e, $request) {
            $headers = $e->getHeaders();
            $seconds = max(1, (int) ($headers['Retry-After'] ?? 60));

            if ($request->is('api/*/admin/login')) {
                $message = 'Too many failed login attempts. Please wait '.$seconds.' seconds before trying again.';
            } elseif ($request->is('api/*/borrower/login', 'api/*/auth/login')) {
                $message = 'Too many failed login attempts. Please wait '.$seconds.' seconds before trying again.';
            } elseif ($request->is('api/*/borrower/forgot-password', 'api/*/admin/forgot-password', 'api/*/borrower/otp/request', 'api/*/borrower/password/forgot-otp')) {
                $message = 'Too many password reset requests. Please wait '.$seconds.' seconds before trying again.';
            } elseif ($request->is('api/*/borrower/otp/verify', 'api/*/borrower/verify-otp')) {
                $message = 'Too many verification attempts. Please wait '.$seconds.' seconds before trying again.';
            } elseif ($request->is('api/*/public/chat/*', 'api/*/chatbot/*')) {
                $message = 'Too many chat requests. Please wait '.$seconds.' seconds before trying again.';
            } else {
                $message = 'Too many requests. Please wait '.$seconds.' seconds before trying again.';
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => $message,
                    'retry_after' => $seconds,
                ], 429, $e->getHeaders());
            }

            return response($message, 429, $e->getHeaders());
        });

        $this->renderable(function (InvalidSignatureException $e, $request) {
            if (! $request->is(
                'api/v1/borrower/email/verify',
                'api/v1/borrower/email/verify/*',
                'borrower/email/verify',
                'borrower/email/verify/*',
            )) {
                return null;
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Verification link is invalid or expired.',
                ], 403);
            }

            $isExpired = is_numeric($request->query('expires'))
                && (int) $request->query('expires') < now()->getTimestamp();
            $message = $isExpired
                ? 'This verification link expired. Please request a new email.'
                : 'This verification link is invalid.';

            return $this->borrowerVerifyBrowserResult($request, false, $isExpired ? 'Link expired' : 'Link invalid', $message, [
                'verification_status' => $isExpired ? 'expired' : 'invalid',
                'verification_message' => $message,
            ]);
        });
    }

    /**
     * @param  array<string, string>  $loginParams
     */
    private function borrowerVerifyBrowserResult(
        Request $request,
        bool $ok,
        string $title,
        string $message,
        array $loginParams,
    ) {
        if ($request->expectsJson()) {
            return response()->json([
                'ok' => $ok,
                'message' => $message,
            ], 403);
        }

        return response()
            ->view('borrower.auth.verify-email', [
                'ok' => $ok,
                'title' => $title,
                'message' => $message,
                'status' => $loginParams['verification_status'] ?? ($ok ? 'success' : 'invalid'),
                'loginUrl' => BorrowerVerificationUrl::borrowerLoginUrl($request, $loginParams),
                'logoUrl' => \App\Support\MailLogo::pageLogoUrl(),
                'redirectSeconds' => 0,
            ])
            ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
}
