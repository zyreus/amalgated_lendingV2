<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\PublicStorageUrl;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PublicFileController extends Controller
{
    public function show(string $path): Response
    {
        $decoded = rawurldecode($path);
        $normalized = PublicStorageUrl::normalizeStoredPath($decoded);
        if ($normalized === null || $normalized === '') {
            abort(404);
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
}
