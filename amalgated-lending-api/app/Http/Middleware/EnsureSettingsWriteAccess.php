<?php

namespace App\Http\Middleware;

use App\Support\SettingsAuthorization;
use Closure;
use Illuminate\Http\Request;

class EnsureSettingsWriteAccess
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        if ($user->hasPermission('settings.manage')) {
            return $next($request);
        }

        foreach (SettingsAuthorization::KEY_PERMISSIONS as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
    }
}
