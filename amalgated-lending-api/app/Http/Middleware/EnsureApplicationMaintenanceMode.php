<?php

namespace App\Http\Middleware;

use App\Services\SecurityPolicyService;
use Closure;
use Illuminate\Http\Request;

class EnsureApplicationMaintenanceMode
{
    public function __construct(private SecurityPolicyService $securityPolicy)
    {
    }

    public function handle(Request $request, Closure $next)
    {
        if (! $this->securityPolicy->maintenanceModeEnabled()) {
            return $next($request);
        }

        $user = $request->user();
        if ($user && $user->roles()->where('slug', 'super-admin')->exists()) {
            return $next($request);
        }

        $path = trim($request->path(), '/');
        if (str_starts_with($path, 'api/v1/admin/login')) {
            return $next($request);
        }

        return response()->json([
            'ok' => false,
            'message' => 'The system is under maintenance. Please try again later.',
            'code' => 'maintenance_mode',
        ], 503);
    }
}
