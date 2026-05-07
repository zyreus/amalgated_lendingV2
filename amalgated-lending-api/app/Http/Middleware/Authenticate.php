<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     *
     * @param  Request  $request
     * @return string|null
     */
    protected function redirectTo($request)
    {
        // API-only app: there is no web `login` named route. Never call `route('login')` or
        // unauthenticated requests throw RouteNotFoundException and become HTTP 500.
        if ($request->is('api/*') || $request->expectsJson() || $request->ajax()) {
            return null;
        }

        return null;
    }
}
