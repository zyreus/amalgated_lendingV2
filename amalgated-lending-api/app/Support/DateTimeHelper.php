<?php

namespace App\Support;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Config;

final class DateTimeHelper
{
    public static function displayTimezone(): string
    {
        return (string) Config::get('datetime.display_timezone', 'Asia/Manila');
    }

    /**
     * Interpret a stored value as UTC instant and shift to display timezone for UI / exports.
     */
    public static function toDisplay(CarbonInterface|string|null $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }
        $c = $value instanceof CarbonInterface ? Carbon::instance($value) : Carbon::parse($value);

        return $c->clone()->timezone(self::displayTimezone());
    }

    public static function diffForHumansDisplay(CarbonInterface|string|null $value): ?string
    {
        $c = self::toDisplay($value);

        return $c?->diffForHumans();
    }
}
