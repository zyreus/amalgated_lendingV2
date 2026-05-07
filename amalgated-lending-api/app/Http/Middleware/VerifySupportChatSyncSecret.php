<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifySupportChatSyncSecret
{
    public function handle(Request $request, Closure $next): Response
    {
        $configured = config('services.support_chat.sync_secret');
        if (! is_string($configured) || $configured === '') {
            abort(Response::HTTP_NOT_FOUND);
        }

        $sent = $request->header('X-Support-Sync-Secret', '');
        if (! hash_equals($configured, $sent)) {
            abort(Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
