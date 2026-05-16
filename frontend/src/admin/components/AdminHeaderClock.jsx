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
  return VALID_VARIANTS.includes(/** @type {any} */ (v)) ? v : 'minimal'
}

/**
 * Resolve variant: explicit prop wins, then Vite env `VITE_ADMIN_HEADER_CLOCK_VARIANT`, then `minimal`.
 * @param {AdminHeaderClockVariant | undefined} prop
 */
function resolveVariant(prop) {
  if (prop && VALID_VARIANTS.includes(prop)) return prop
  try {
    return normalizeVariant(import.meta.env.VITE_ADMIN_HEADER_CLOCK_VARIANT)
  } catch {
    return 'minimal'
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

  const compactLine = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date)

  return { time, dateLine, dayLine, compactLine }
}

function ClockIcon({ className }) {
  return (
    <svg
      className={`shrink-0 text-[#DC2626] ${className || ''}`}
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
 * Compact live clock for the admin header (similar footprint to the notifications `p-2` control).
 * Updates every second while the tab is visible.
 *
 * **Variants** (prop `variant` or `VITE_ADMIN_HEADER_CLOCK_VARIANT`):
 * - `minimal` — white card, neutral border (default).
 * - `glass` — light frosted panel.
 * - `premium` — subtle red left accent bar.
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
  const title = `${parts.time} · ${parts.dateLine} · ${parts.dayLine} (${tzLabel})`

  const shell = {
    minimal:
      'group inline-flex h-10 shrink-0 items-center rounded-lg border border-gray-200/90 bg-white px-2.5 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50/90 dark:border-white/10 dark:bg-gray-900 dark:hover:bg-gray-800/90',
    glass:
      'group inline-flex h-10 shrink-0 items-center rounded-lg border border-white/70 bg-white/65 px-2.5 text-left shadow-sm backdrop-blur-md transition-colors duration-150 hover:bg-white/80 dark:border-white/10 dark:bg-gray-950/50 dark:hover:bg-gray-950/70',
    premium:
      'group inline-flex h-10 shrink-0 items-center rounded-lg border border-gray-200/90 border-l-[3px] border-l-[#DC2626] bg-white px-2.5 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50/90 dark:border-gray-700/80 dark:border-l-red-500 dark:bg-gray-900 dark:hover:bg-gray-800/90',
  }[variant]

  return (
    <div className={shell} aria-live="polite" aria-atomic="true" title={title}>
      <div className="flex items-center gap-1.5">
        <ClockIcon className="h-3.5 w-3.5" />
        <div className="flex min-w-0 flex-col justify-center gap-0 leading-none">
          <p className="text-xs font-bold tabular-nums tracking-tight text-gray-900 dark:text-gray-50">{parts.time}</p>
          <p className="max-w-[6.5rem] truncate text-[9px] font-medium capitalize text-gray-500 dark:text-gray-400">
            {parts.compactLine}
          </p>
        </div>
      </div>
    </div>
  )
}
