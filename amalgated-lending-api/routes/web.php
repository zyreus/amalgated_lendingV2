<?php

use App\Http\Controllers\Web\BorrowerEmailVerificationController;
use App\Http\Controllers\Web\LoanPrintController;
use App\Http\Controllers\Web\SoaStatementDownloadController;
use App\Http\Controllers\Web\SiteController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', [SiteController::class, 'home']);

/*
| Borrower email verification (signed URLs from inbox — must be web routes, not SPA).
| Canonical: /borrower/email/verify/{id}/{hash}?expires=&signature=
| Legacy:    /borrower/email/verify?id=&hash=&expires=&signature=
*/
Route::middleware(['throttle:72,1'])->group(function () {
    Route::get('/borrower/email/notice', [BorrowerEmailVerificationController::class, 'notice'])
        ->name('borrower.email.notice');

    Route::get('/borrower/email/verify/{id}/{hash}', [BorrowerEmailVerificationController::class, 'verify'])
        ->where(['id' => '[0-9]+', 'hash' => '[a-f0-9]+'])
        ->name('borrower.email.verify');

    Route::get('/borrower/email/verify', [BorrowerEmailVerificationController::class, 'verifyLegacyQuery'])
        ->name('borrower.email.verify.legacy');

    Route::get('/borrower/statements/{statement}/download/{hash}', [SoaStatementDownloadController::class, 'download'])
        ->middleware('signed')
        ->where(['statement' => '[0-9]+', 'hash' => '[a-f0-9]+'])
        ->name('borrower.soa.download');
});

Route::domain('www.amalgatedlending.com')
    ->any('/{any?}', [SiteController::class, 'redirectWww'])
    ->where('any', '.*');

$chatDomain = env('CHAT_SUBDOMAIN', 'chat.amalgatedlending.com');
Route::domain($chatDomain)->group(function () {
    Route::view('/', 'chat-only')->name('chat.only');
    Route::view('/{any}', 'chat-only')->where('any', '.*');
});

Route::view('/loan-application-demo', 'loan-application-form')->name('loan.application.demo');

Route::view('/travel-assistance/terms', 'travel.terms')->name('travel.terms');

Route::get('/print/general-loan/{loanApplication}', [LoanPrintController::class, 'generalLoan'])->name('print.general-loan');
Route::get('/print/travel-loan/{travelApplication}', [LoanPrintController::class, 'travelLoan'])->name('print.travel-loan');
Route::get('/print/loan-soa/{loan}', [LoanPrintController::class, 'loanSoa'])->name('print.loan-soa');

Route::get('/test', function () {
    return response()->json([
        'time' => now(),
        'memory' => memory_get_usage(true),
    ]);
});

/*
|--------------------------------------------------------------------------
| Vite React SPA (admin + borrower + marketing)
|--------------------------------------------------------------------------
| Client routes must return index.html. Static JS/CSS are under /assets (copy dist to public; see `npm run build:laravel`).
| API uses /api (registered first in RouteServiceProvider). Filament uses /filament (not /admin).
*/
Route::fallback(function () {
    if (! request()->isMethod('GET') && ! request()->isMethod('HEAD')) {
        abort(404);
    }

    $path = request()->path();
    if (preg_match('#^borrower/email/verify(/|$)#', $path) || $path === 'borrower/email/notice') {
        abort(404);
    }

    $first = explode('/', $path, 2)[0] ?? '';
    $reserved = ['api', 'filament', 'sanctum', 'livewire', 'storage', 'vendor', '_debugbar', 'build', 'horizon', 'telescope'];
    if (in_array($first, $reserved, true)) {
        abort(404);
    }

    return app(SiteController::class)->spa(request());
});
