<?php

namespace App\Http\Middleware;

use App\Services\SecurityPolicyService;
use Closure;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;

class EnforceJwtSessionTimeout
{
    public function __construct(private SecurityPolicyService $securityPolicy)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        if (! auth('api')->check()) {
            return $next($request);
        }

        $user = auth('api')->user();
        if (! $user || ! $user->canAccessAdminPortal()) {
            return $next($request);
        }

        try {
            $payload = auth('api')->payload();
            $iat = (int) $payload->get('iat');
            if ($iat <= 0) {
                return $next($request);
            }

            $timeoutSeconds = $this->securityPolicy->sessionTimeoutMinutes() * 60;
            if ((time() - $iat) > $timeoutSeconds) {
                auth('api')->logout();

                return response()->json([
                    'ok' => false,
                    'message' => 'Session expired. Please sign in again.',
                    'code' => 'session_expired',
                ], 401);
            }
        } catch (JWTException) {
            return response()->json(['ok' => false, 'message' => 'Invalid token.'], 401);
        }

        return $next($request);
    }
}
