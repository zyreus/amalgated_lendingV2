<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsurePermission
{
    public function handle(Request $request, Closure $next, string $permissionSlug)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $slugs = array_values(array_filter(array_map('trim', explode('|', $permissionSlug))));
        if ($slugs === []) {
            return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        foreach ($slugs as $slug) {
            if ($user->hasPermission($slug)) {
                return $next($request);
            }
        }

        return response()->json(['ok' => false, 'message' => 'Forbidden.'], 403);
    }
}
