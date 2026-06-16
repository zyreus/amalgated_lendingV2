<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\PublicStorageUrl;
use App\Support\SensitiveStorageAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class PublicFileController extends Controller
{
    public function show(Request $request, string $path): Response
    {
        $decoded = rawurldecode($path);
        $normalized = PublicStorageUrl::normalizeStoredPath($decoded);
        if ($normalized === null || $normalized === '') {
            abort(404);
        }

        if (PublicStorageUrl::isSensitivePath($normalized)) {
            $user = $this->optionalApiUser($request);
            if (! $request->hasValidSignature() && ! SensitiveStorageAccess::canRead($user, $normalized)) {
                abort(404);
            }
        }

        $disk = Storage::disk('public');
        if (! $disk->exists($normalized)) {
            Log::warning('Public storage file missing.', [
                'normalized_path' => $normalized,
                'raw_route_param' => $path,
            ]);
            abort(404);
        }

        return $disk->response($normalized);
    }

    private function optionalApiUser(Request $request): ?\App\Models\User
    {
        if (! $request->bearerToken()) {
            return null;
        }

        try {
            return auth('api')->authenticate();
        } catch (Throwable) {
            return null;
        }
    }
}
