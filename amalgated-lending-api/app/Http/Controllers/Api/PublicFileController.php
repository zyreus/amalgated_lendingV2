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
            $signatureOk = $request->hasValidSignature(false);
            if (! $signatureOk && ! SensitiveStorageAccess::canRead($user, $normalized)) {
                Log::info('Public storage access denied.', [
                    'normalized_path' => $normalized,
                    'user_id' => $user?->id,
                    'has_bearer' => $request->bearerToken() !== null,
                    'has_signature_param' => $request->has('signature'),
                ]);
                abort(404);
            }
        }

        $disk = Storage::disk('public');
        if (! $disk->exists($normalized)) {
            Log::warning('Public storage file missing.', [
                'normalized_path' => $normalized,
                'raw_route_param' => $path,
                'disk_root' => $disk->path(''),
                'resolved_full_path' => $disk->path($normalized),
            ]);
            abort(404);
        }

        Log::debug('Public storage file served.', [
            'normalized_path' => $normalized,
            'resolved_full_path' => $disk->path($normalized),
        ]);

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
