<?php

namespace App\Services;

use App\Models\SystemSetting;
use Illuminate\Support\Facades\Cache;

class SettingsService
{
    public const CACHE_PREFIX = 'system_setting:';

    public const CACHE_TTL_SECONDS = 300;

    public function get(string $key, ?array $default = null): array
    {
        return Cache::remember(
            self::CACHE_PREFIX.$key,
            self::CACHE_TTL_SECONDS,
            function () use ($key, $default) {
                $row = SystemSetting::where('key', $key)->first();

                return $row?->value ?? ($default ?? []);
            }
        );
    }

    public function forget(string $key): void
    {
        Cache::forget(self::CACHE_PREFIX.$key);
    }

    public function forgetAll(): void
    {
        SystemSetting::query()->pluck('key')->each(fn (string $key) => $this->forget($key));
    }

    public function all(): array
    {
        $rows = SystemSetting::query()->orderBy('key')->get();
        $settings = [];
        foreach ($rows as $row) {
            $settings[$row->key] = [
                'key_name' => $row->key,
                'value' => $row->value ?? [],
                'updated_at' => $row->updated_at,
            ];
        }

        return $settings;
    }
}
