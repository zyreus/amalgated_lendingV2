<?php

namespace App\Http\Controllers\Web;

use Illuminate\Contracts\View\View as ViewContract;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SiteController extends Controller
{
    /**
     * Home page: React SPA when a build exists, otherwise default Laravel welcome view.
     */
    public function home(Request $request): BinaryFileResponse|ViewContract|Response
    {
        return $this->reactSpa();
    }

    /**
     * SPA shell for client-side routes (e.g. /admin, /borrower/login, /loan-products).
     */
    public function spa(Request $request): BinaryFileResponse|ViewContract|Response
    {
        return $this->reactSpa();
    }

    public function redirectWww(Request $request): RedirectResponse
    {
        return redirect()->away('https://amalgatedlending.com'.$request->getRequestUri(), 301);
    }

    private function reactSpa(): BinaryFileResponse|ViewContract|Response
    {
        $path = $this->spaIndexPath();
        if ($path !== null) {
            /**
             * `index.html` must stay uncached (or short-TTL): it references hashed `/assets/*.js`.
             * Stale shells + fresh assets = intermittent React "Cannot read properties of null
             * (reading 'useContext')" and broken admin/borrower login.
             */
            return response()->file($path, [
                'Content-Type' => 'text/html; charset=UTF-8',
                'Cache-Control' => 'no-cache, must-revalidate, max-age=0',
            ]);
        }

        return view('welcome');
    }

    /**
     * Prefer `public/index.html` (deploy target from `npm run build:laravel`) over `../dist/index.html`.
     * Otherwise production can ship a stale monorepo `dist/` shell while `/assets/` is synced to `public/`,
     * causing chunk hash mismatches.
     */
    private function spaIndexPath(): ?string
    {
        $configured = env('SPA_INDEX_PATH');
        if (is_string($configured) && $configured !== '' && is_readable($configured)) {
            return $configured;
        }

        $publicIndex = public_path('index.html');
        if (is_readable($publicIndex)) {
            return $publicIndex;
        }

        $monorepoDist = base_path('../dist/index.html');
        if (is_readable($monorepoDist)) {
            return $monorepoDist;
        }

        return null;
    }
}
