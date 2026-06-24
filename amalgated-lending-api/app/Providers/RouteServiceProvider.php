<?php

namespace App\Providers;

use App\Models\User;
use App\Services\SecurityPolicyService;
use App\Support\AuthRateLimit;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to the "home" route for your application.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     *
     * @return void
     */
    public function boot()
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }

    /**
     * Configure the rate limiters for the application.
     *
     * @return void
     */
    protected function configureRateLimiting()
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(180)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('liveness', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip());
        });

        RateLimiter::for('face_verify', function (Request $request) {
            return Limit::perMinute(20)->by($request->user()?->id ?: $request->ip());
        });

        /** Admin login: attempts from security settings (super-admin: +5). */
        RateLimiter::for(AuthRateLimit::ADMIN_LOGIN, function (Request $request) {
            $login = mb_strtolower(trim((string) $request->input('username')));
            $maxAttempts = app(SecurityPolicyService::class)->maxLoginAttempts();

            if ($login !== '') {
                $user = User::query()
                    ->where(function ($q) use ($login) {
                        $q->whereRaw('LOWER(username) = ?', [$login])
                            ->orWhereRaw('LOWER(email) = ?', [$login]);
                    })
                    ->first();

                if ($user && $user->roles()->where('slug', 'super-admin')->exists()) {
                    $maxAttempts = min(20, $maxAttempts + 5);
                }
            }

            return Limit::perSecond($maxAttempts, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, $login));
        });

        /** Borrower login: attempts from security settings. */
        RateLimiter::for(AuthRateLimit::BORROWER_LOGIN, function (Request $request) {
            $login = mb_strtolower(trim((string) (AuthRateLimit::resolveLoginIdentifier($request))));
            $maxAttempts = app(SecurityPolicyService::class)->maxLoginAttempts();

            return Limit::perSecond($maxAttempts, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, $login));
        });

        /** Generic JWT login: attempts from security settings. */
        RateLimiter::for(AuthRateLimit::GENERIC_LOGIN, function (Request $request) {
            $login = mb_strtolower(trim((string) $request->input('username')));
            $maxAttempts = app(SecurityPolicyService::class)->maxLoginAttempts();

            return Limit::perSecond($maxAttempts, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, $login));
        });

        RateLimiter::for(AuthRateLimit::REGISTER, function (Request $request) {
            return Limit::perSecond(6, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, (string) $request->input('email')));
        });

        /** OTP verification: 10 attempts / 30 seconds per username + IP. */
        RateLimiter::for(AuthRateLimit::OTP_VERIFY, function (Request $request) {
            $login = mb_strtolower(trim((string) $request->input('username')));

            return Limit::perSecond(10, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, $login));
        });

        /** Password reset + OTP request: 5 attempts / 30 seconds per email/username + IP. */
        RateLimiter::for(AuthRateLimit::PASSWORD_RESET, function (Request $request) {
            $login = mb_strtolower(trim((string) (AuthRateLimit::resolveLoginIdentifier($request))));

            return Limit::perSecond(AuthRateLimit::PASSWORD_RESET_MAX_ATTEMPTS, AuthRateLimit::LOCKOUT_DECAY_SECONDS)
                ->by(AuthRateLimit::loginKey($request, $login));
        });
    }
}
