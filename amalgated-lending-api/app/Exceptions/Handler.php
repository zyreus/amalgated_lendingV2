<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Routing\Exceptions\InvalidSignatureException;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * A list of exception types with their corresponding custom log levels.
     *
     * @var array<class-string<\Throwable>, \Psr\Log\LogLevel::*>
     */
    protected $levels = [
        //
    ];

    /**
     * A list of the exception types that are not reported.
     *
     * @var array<int, class-string<\Throwable>>
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

        $this->renderable(function (InvalidSignatureException $e, $request) {
            if (! $request->is('api/v1/borrower/email/verify')) {
                return null;
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Verification link is invalid or expired.',
                ], 403);
            }

            $frontend = rtrim((string) config('app.frontend_url'), '/');
            $path = '/'.ltrim((string) config('services.borrower_verify.login_path', '/borrower/login'), '/');
            $isExpired = is_numeric($request->query('expires'))
                && (int) $request->query('expires') < now()->getTimestamp();
            $query = http_build_query([
                'verification_status' => $isExpired ? 'expired' : 'invalid',
                'verification_message' => $isExpired
                    ? 'This verification link expired. Please request a new email.'
                    : 'This verification link is invalid.',
            ]);

            return redirect()->away("{$frontend}{$path}?{$query}");
        });
    }
}
