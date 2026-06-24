<?php

use App\Services\SettingsService;
use Illuminate\Support\Facades\App;

if (! function_exists('setting')) {
    function setting(string $key): array
    {
        return App::make(SettingsService::class)->get($key, []);
    }
}
