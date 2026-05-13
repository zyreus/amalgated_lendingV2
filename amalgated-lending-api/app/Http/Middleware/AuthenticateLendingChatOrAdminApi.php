<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;

/**
 * Matches chat-server `requireAdminOrLendingSecret` for same-origin CRM calls:
 * Bearer {@see config('app.lending_admin_api_secret')} or a valid admin JWT.
 */
class AuthenticateLendingChatOrAdminApi
{
    public function handle(Request $request, Closure $next)
    {
        $configured = trim((string) config('app.lending_admin_api_secret', ''));
        $authHeader = (string) $request->header('Authorization', '');
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
            $token = trim($m[1]);
            if ($configured !== '' && hash_equals($configured, $token)) {
                return $next($request);
            }
        }

        try {
            $user = JWTAuth::parseToken()->authenticate();
        } catch (JWTException) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);
        }

        if (! $user || ! $user->canAccessAdminPortal()) {
            return response()->json(['ok' => false, 'message' => 'Admin access required.'], 403);
        }
        if (! $user->is_active) {
            return response()->json(['ok' => false, 'message' => 'Account is deactivated.'], 403);
        }

        auth('api')->setUser($user);

        return $next($request);
    }
}
