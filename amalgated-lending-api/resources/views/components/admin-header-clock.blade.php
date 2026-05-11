{{--
  Premium live clock + date (Asia/Manila, 12h). Reusable Blade partial for Filament / Blade admin shells.

  Usage:
    <x-admin-header-clock />
    <x-admin-header-clock variant="minimal" />
    <x-admin-header-clock variant="glass" />
    <x-admin-header-clock variant="premium" />

  Tailwind: add this file path to your Tailwind `content` array so utilities are not purged.
  Variants mirror `frontend/src/admin/components/AdminHeaderClock.jsx`.
--}}
@props([
    'variant' => 'premium',
    'timeZone' => 'Asia/Manila',
    'locale' => 'en-PH',
])

@php
    $v = in_array($variant, ['minimal', 'glass', 'premium'], true) ? $variant : 'premium';
    $tzLabel = str_replace('_', ' ', $timeZone);
@endphp

@php
    $shell = match ($v) {
        'minimal' => 'group relative flex w-[min(100%,9.5rem)] flex-col rounded-xl border border-gray-200/95 bg-white px-3 py-2.5 shadow-sm shadow-gray-900/[0.045] transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-gray-300/90 hover:shadow-md motion-reduce:hover:translate-y-0 sm:w-[9.75rem] dark:border-white/10 dark:bg-gray-900/95',
        'glass' => 'group relative flex w-[min(100%,10rem)] flex-col rounded-xl border border-white/70 bg-white/60 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-white/90 hover:bg-white/75 hover:shadow-[0_12px_40px_-10px_rgba(15,23,42,0.14)] motion-reduce:hover:translate-y-0 sm:w-[10.25rem] dark:border-white/10 dark:bg-gray-950/45',
        default => 'group relative flex w-[min(100%,10.25rem)] flex-col rounded-xl bg-gradient-to-br from-[#DC2626]/25 via-gray-200/70 to-gray-100/80 p-[1px] shadow-[0_4px_24px_-4px_rgba(220,38,38,0.12),0_8px_28px_-12px_rgba(15,23,42,0.1)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_6px_28px_-4px_rgba(220,38,38,0.16),0_12px_36px_-12px_rgba(15,23,42,0.12)] motion-reduce:hover:translate-y-0 sm:w-[10.5rem] dark:from-red-500/30 dark:via-white/10 dark:to-gray-900/50',
    };
    $inner = $v === 'premium'
        ? 'relative flex w-full min-w-0 flex-col rounded-[11px] bg-gradient-to-b from-white to-gray-50/95 px-3 py-2.5 dark:from-gray-900 dark:to-gray-950/95'
        : 'flex w-full min-w-0 flex-col';
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
    title="Local time ({{ $tzLabel }})"
>
    <div class="{{ $inner }}">
        @if ($v === 'premium')
            <div class="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2 dark:border-white/5">
                <span class="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#DC2626]/90 dark:text-red-400/90">Live</span>
                <span class="max-w-[5.5rem] truncate text-[9px] font-medium text-gray-400 dark:text-gray-500">{{ $tzLabel }}</span>
            </div>
        @endif

        <div class="flex items-center justify-end gap-2">
            <svg
                class="al-admin-clock-icon h-4 w-4 shrink-0 text-[#DC2626] {{ $v === 'premium' ? 'al-admin-clock-icon--pulse' : '' }}"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="9" stroke-linecap="round" />
                <path stroke-linecap="round" d="M12 8v4l2.5 1.5" />
            </svg>
            <p data-clock-time class="min-w-0 text-right text-[15px] font-bold tabular-nums leading-none tracking-tight text-gray-900 sm:text-base dark:text-gray-50"></p>
        </div>

        <div class="my-2 h-px w-full bg-gradient-to-r from-transparent via-gray-200/95 to-transparent dark:via-white/10" aria-hidden="true"></div>

        <p data-clock-date class="truncate text-right text-xs font-semibold leading-snug tracking-tight text-gray-700 dark:text-gray-300"></p>
        <p data-clock-day class="mt-1 truncate text-right text-[10px] font-medium capitalize leading-none tracking-wide text-gray-400 sm:text-[11px] dark:text-gray-500"></p>
    </div>
</div>

@once
    <style>
        @keyframes al-admin-clock-icon-pulse {
            0%,
            100% {
                opacity: 1;
            }
            50% {
                opacity: 0.72;
            }
        }
        .al-admin-clock-icon--pulse {
            animation: al-admin-clock-icon-pulse 2.75s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
            .al-admin-clock-icon--pulse {
                animation: none;
            }
        }
    </style>
    <script>
        (function () {
            if (window.__AL_ADMIN_HEADER_CLOCK__) return;
            window.__AL_ADMIN_HEADER_CLOCK__ = true;

            function tick(root) {
                var tz = root.getAttribute('data-time-zone') || 'Asia/Manila';
                var loc = root.getAttribute('data-locale') || 'en-PH';
                var d = new Date();
                var elTime = root.querySelector('[data-clock-time]');
                var elDate = root.querySelector('[data-clock-date]');
                var elDay = root.querySelector('[data-clock-day]');
                if (!elTime || !elDate || !elDay) return;
                elTime.textContent = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                }).format(d);
                elDate.textContent = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                }).format(d);
                elDay.textContent = new Intl.DateTimeFormat(loc, {
                    timeZone: tz,
                    weekday: 'long',
                }).format(d);
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
