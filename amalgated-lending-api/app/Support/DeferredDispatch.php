<?php

namespace App\Support;

/**
 * Queue work after the HTTP response is sent so admin/borrower modals close quickly.
 */
final class DeferredDispatch
{
    public static function run(object $job): void
    {
        try {
            dispatch($job)->afterResponse();
        } catch (\Throwable $e) {
            report($e);
            try {
                dispatch($job);
            } catch (\Throwable $fallback) {
                report($fallback);
            }
        }
    }
}
