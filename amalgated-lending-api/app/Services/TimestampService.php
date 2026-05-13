<?php

namespace App\Services;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use DateTimeInterface;
use Illuminate\Support\Facades\Date;

class TimestampService
{
    /**
     * Convert an instant stored in UTC to a named IANA timezone (or app default).
     */
    public function toZoned(CarbonInterface|DateTimeInterface|string|null $utc, ?string $ianaTimeZone = null): ?Carbon
    {
        if ($utc === null || $utc === '') {
            return null;
        }
        $c = $utc instanceof CarbonInterface
            ? $utc->copy()
            : Date::parse($utc);

        return $c->timezone($ianaTimeZone ?: (string) config('app.timezone', 'UTC'));
    }

    public function toIso8601Zulu(CarbonInterface|DateTimeInterface|string|null $utc): ?string
    {
        if ($utc === null || $utc === '') {
            return null;
        }
        $c = $utc instanceof CarbonInterface
            ? $utc->copy()
            : Date::parse($utc);

        return $c->utc()->toIso8601String();
    }

    public function relativeFromUtc(CarbonInterface|DateTimeInterface|string|null $utc, ?CarbonInterface $now = null): ?string
    {
        if ($utc === null || $utc === '') {
            return null;
        }
        $c = $utc instanceof CarbonInterface
            ? $utc->copy()->timezone('UTC')
            : Date::parse($utc)->timezone('UTC');

        return $c->diffForHumans($now ?? Date::now('UTC'));
    }
}
