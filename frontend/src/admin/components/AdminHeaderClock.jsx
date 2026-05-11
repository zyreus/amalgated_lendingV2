import { useEffect, useState } from 'react'

/** Matches CRM / lending ops default (Philippines). */
const TIME_ZONE = 'Asia/Manila'
const LOCALE = 'en-PH'

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

/**
 * Minimal live clock for the admin header — updates every second while the tab is visible.
 */
export default function AdminHeaderClock() {
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

  return (
    <div
      className="flex w-[min(100%,7.5rem)] flex-col items-end rounded-lg border border-gray-200/90 bg-white/95 px-2 py-1.5 shadow-sm dark:border-white/10 dark:bg-[#111827]/95 sm:w-[7.75rem]"
      aria-live="polite"
      aria-atomic="true"
      title={`Local time (${TIME_ZONE.replace('_', ' ')})`}
    >
      <div className="flex items-center gap-1 self-end">
        <svg
          className="h-3.5 w-3.5 shrink-0 text-[#DC2626]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" strokeLinecap="round" />
          <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
        </svg>
        <span className="text-[13px] font-bold tabular-nums leading-none tracking-tight text-gray-900 dark:text-gray-100">
          {parts.time}
        </span>
      </div>
      <p className="mt-1 max-w-full truncate text-right text-[11px] font-medium leading-tight text-gray-600 dark:text-gray-400">
        {parts.dateLine}
      </p>
      <p className="mt-0.5 max-w-full truncate text-right text-[10px] capitalize leading-tight text-gray-400 dark:text-gray-500">
        {parts.dayLine}
      </p>
    </div>
  )
}
