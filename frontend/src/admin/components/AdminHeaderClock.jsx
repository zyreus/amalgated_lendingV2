import { useEffect, useMemo, useState } from 'react'

/** Matches CRM / lending ops default (Philippines). */
const TIME_ZONE = 'Asia/Manila'
const LOCALE = 'en-PH'

/** @typedef {'minimal' | 'glass' | 'premium'} AdminHeaderClockVariant */

const VALID_VARIANTS = /** @type {const} */ (['minimal', 'glass', 'premium'])

/**
 * @param {string | undefined} raw
 * @returns {AdminHeaderClockVariant}
 */
function normalizeVariant(raw) {
  const v = (raw || '').toLowerCase().trim()
  return VALID_VARIANTS.includes(/** @type {any} */ (v)) ? v : 'premium'
}

/**
 * Resolve variant: explicit prop wins, then Vite env `VITE_ADMIN_HEADER_CLOCK_VARIANT`, then `premium`.
 * @param {AdminHeaderClockVariant | undefined} prop
 */
function resolveVariant(prop) {
  if (prop && VALID_VARIANTS.includes(prop)) return prop
  try {
    return normalizeVariant(import.meta.env.VITE_ADMIN_HEADER_CLOCK_VARIANT)
  } catch {
    return 'premium'
  }
}

function formatParts(date) {
  const time = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)

  const dateLine = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)

  const dayLine = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: 'long',
  }).format(date)

  return { time, dateLine, dayLine }
}

function ClockIcon({ className, pulse }) {
  return (
    <svg
      className={`shrink-0 text-[#DC2626] ${pulse ? 'motion-reduce:animate-none animate-clock-icon-pulse' : ''} ${className || ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeLinecap="round" />
      <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
    </svg>
  )
}

/**
 * Premium live clock for the admin header — updates every second while the tab is visible.
 *
 * **Variants** (prop `variant` or `VITE_ADMIN_HEADER_CLOCK_VARIANT`):
 * - `minimal` — crisp elevated card, soft shadow, subtle hover.
 * - `glass` — frosted glass, backdrop blur, airy fintech panel.
 * - `premium` — gradient accent frame, status rail, subtle icon pulse (default).
 *
 * @param {{ variant?: AdminHeaderClockVariant }} props
 */
export default function AdminHeaderClock({ variant: variantProp }) {
  const variant = useMemo(() => resolveVariant(variantProp), [variantProp])
  const [parts, setParts] = useState(() => formatParts(new Date()))

  useEffect(() => {
    let intervalId

    const tick = () => {
      setParts(formatParts(new Date()))
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }

    tick()
    intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        tick()
      }
    }, 1000)

    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const tzLabel = TIME_ZONE.replace('_', ' ')
  const title = `Local time (${tzLabel})`

  const shell = {
    minimal:
      'group relative flex w-[min(100%,9.5rem)] flex-col rounded-xl border border-gray-200/95 bg-white px-3 py-2.5 shadow-sm shadow-gray-900/[0.045] transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-gray-300/90 hover:shadow-md hover:shadow-gray-900/[0.06] motion-reduce:hover:translate-y-0 sm:w-[9.75rem] dark:border-white/10 dark:bg-gray-900/95 dark:shadow-black/20 dark:hover:border-white/15',
    glass:
      'group relative flex w-[min(100%,10rem)] flex-col rounded-xl border border-white/70 bg-white/60 px-3.5 py-2.5 shadow-[0_8px_32px_-8px_rgba(15,23,42,0.12)] backdrop-blur-xl backdrop-saturate-150 transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-white/90 hover:bg-white/75 hover:shadow-[0_12px_40px_-10px_rgba(15,23,42,0.14)] motion-reduce:hover:translate-y-0 sm:w-[10.25rem] dark:border-white/10 dark:bg-gray-950/45 dark:hover:bg-gray-950/55',
    premium:
      'group relative flex w-[min(100%,10.25rem)] flex-col rounded-xl bg-gradient-to-br from-[#DC2626]/25 via-gray-200/70 to-gray-100/80 p-[1px] shadow-[0_4px_24px_-4px_rgba(220,38,38,0.12),0_8px_28px_-12px_rgba(15,23,42,0.1)] transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_6px_28px_-4px_rgba(220,38,38,0.16),0_12px_36px_-12px_rgba(15,23,42,0.12)] motion-reduce:hover:translate-y-0 sm:w-[10.5rem] dark:from-red-500/30 dark:via-white/10 dark:to-gray-900/50',
  }[variant]

  const inner =
    variant === 'premium'
      ? 'relative flex w-full min-w-0 flex-col rounded-[11px] bg-gradient-to-b from-white to-gray-50/95 px-3 py-2.5 dark:from-gray-900 dark:to-gray-950/95'
      : 'flex w-full min-w-0 flex-col'

  const iconPulse = variant === 'premium'

  return (
    <div className={shell} aria-live="polite" aria-atomic="true" title={title}>
      <div className={inner}>
        {variant === 'premium' ? (
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-gray-100 pb-2 dark:border-white/5">
            <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#DC2626]/90 dark:text-red-400/90">
              Live
            </span>
            <span className="max-w-[5.5rem] truncate text-[9px] font-medium text-gray-400 dark:text-gray-500" title={tzLabel}>
              {tzLabel}
            </span>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2">
          <ClockIcon className="h-4 w-4" pulse={iconPulse} />
          <p className="min-w-0 text-right text-[15px] font-bold tabular-nums leading-none tracking-tight text-gray-900 sm:text-base dark:text-gray-50">
            {parts.time}
          </p>
        </div>

        <div
          className="my-2 h-px w-full bg-gradient-to-r from-transparent via-gray-200/95 to-transparent dark:via-white/10"
          aria-hidden
        />

        <p className="truncate text-right text-xs font-semibold leading-snug tracking-tight text-gray-700 dark:text-gray-300">
          {parts.dateLine}
        </p>
        <p className="mt-1 truncate text-right text-[10px] font-medium capitalize leading-none tracking-wide text-gray-400 sm:text-[11px] dark:text-gray-500">
          {parts.dayLine}
        </p>
      </div>
    </div>
  )
}
