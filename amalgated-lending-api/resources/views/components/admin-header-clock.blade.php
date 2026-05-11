{{--
  Compact live clock + date (Asia/Manila, 12h) — similar footprint to a `p-2` header icon control.

  Usage:
    <x-admin-header-clock />
    <x-admin-header-clock variant="minimal" />
    <x-admin-header-clock variant="glass" />
    <x-admin-header-clock variant="premium" />

  Tailwind: add this file path to your Tailwind `content` array so utilities are not purged.
  Variants mirror `frontend/src/admin/components/AdminHeaderClock.jsx`.
--}}
@props([
    'variant' => 'minimal',
    'timeZone' => 'Asia/Manila',
    'locale' => 'en-PH',
])

@php
    $v = in_array($variant, ['minimal', 'glass', 'premium'], true) ? $variant : 'minimal';
    $tzLabel = str_replace('_', ' ', $timeZone);
@endphp

@php
    $shell = match ($v) {
        'minimal' => 'group inline-flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-gray-200/90 bg-white p-2 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50/90 dark:border-white/10 dark:bg-gray-900 dark:hover:bg-gray-800/90',
        'glass' => 'group inline-flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-white/70 bg-white/65 p-2 text-left shadow-sm backdrop-blur-md transition-colors duration-150 hover:bg-white/80 dark:border-white/10 dark:bg-gray-950/50 dark:hover:bg-gray-950/70',
        default => 'group inline-flex shrink-0 flex-col justify-center gap-0.5 rounded-lg border border-gray-200/90 border-l-[3px] border-l-[#DC2626] bg-white p-2 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50/90 dark:border-gray-700/80 dark:border-l-red-500 dark:bg-gray-900 dark:hover:bg-gray-800/90',
    };
@endphp

<div
    id="admin-header-clock-{{ uniqid() }}"
    class="{{ $shell }}"
    data-clock-root
    data-variant="{{ $v }}"
    data-time-zone="{{ e($timeZone) }}"
    data-locale="{{ e($locale) }}"
    aria-live="polite"
    aria-atomic="true"
    data-clock-title-tz="{{ e($tzLabel) }}"
>
    <div class="flex items-start gap-1.5">
        <svg
            class="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#DC2626]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" stroke-linecap="round" />
            <path stroke-linecap="round" d="M12 8v4l2.5 1.5" />
        </svg>
        <div class="flex min-w-0 flex-col gap-0.5 leading-none">
            <p data-clock-time class="text-xs font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50"></p>
            <p data-clock-compact class="max-w-[6.5rem] truncate text-[9px] font-medium capitalize text-gray-500 dark:text-gray-400"></p>
        </div>
    </div>
</div>

@once
    <script>
        (function () {
            if (window.__AL_ADMIN_HEADER_CLOCK__) return;
            window.__AL_ADMIN_HEADER_CLOCK__ = true;

            function tick(root) {
                var tz = root.getAttribute('data-time-zone') || 'Asia/Manila';
                var loc = root.getAttribute('data-locale') || 'en-PH';
                var d = new Date();
                var elTime = root.querySelector('[data-clock-time]');
                var elCompact = root.querySelector('[data-clock-compact]');
                if (!elTime || !elCompact) return;
                elTime.textContent = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                }).format(d);
                elCompact.textContent = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                }).format(d);
                var dateLong = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                }).format(d);
                var dayLong = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    weekday: 'long',
                }).format(d);
                var tzLabel = root.getAttribute('data-clock-title-tz') || tz;
                root.title =
                    elTime.textContent + ' · ' + dateLong + ' · ' + dayLong + ' (' + tzLabel + ')';
            }

            function tickAll() {
                document.querySelectorAll('[data-clock-root]').forEach(tick);
            }

            function boot() {
                tickAll();
                setInterval(function () {
                    if (document.visibilityState !== 'hidden') tickAll();
                }, 1000);
                document.addEventListener('visibilitychange', function () {
                    if (document.visibilityState === 'visible') tickAll();
                });
            }

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', boot);
            } else {
                boot();
            }
        })();
    </script>
@endonce
