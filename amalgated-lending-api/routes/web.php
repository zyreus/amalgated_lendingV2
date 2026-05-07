<?php

use App\Http\Controllers\Web\LoanPrintController;
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

    $first = explode('/', request()->path(), 2)[0] ?? '';
    $reserved = ['api', 'filament', 'sanctum', 'livewire', 'storage', 'vendor', '_debugbar', 'build', 'horizon', 'telescope'];
    if (in_array($first, $reserved, true)) {
        abort(404);
    }

    return app(SiteController::class)->spa(request());
});
