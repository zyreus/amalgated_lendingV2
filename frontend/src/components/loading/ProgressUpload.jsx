import { useEffect } from 'react'
import LoadingSpinner from './LoadingSpinner.jsx'

function preventRefresh(e) {
  e.preventDefault()
  e.returnValue = ''
}

/**
 * Upload progress bar with optional page-unload guard.
 */
export default function ProgressUpload({
  percent = 0,
  label = 'Uploading...',
  show = false,
  preventNavigation = true,
}) {
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  const active = show || p > 0

  useEffect(() => {
    if (!active || !preventNavigation) return undefined
    window.addEventListener('beforeunload', preventRefresh)
    return () => window.removeEventListener('beforeunload', preventRefresh)
  }, [active, preventNavigation])

  if (!active) return null

  return (
    <div
      className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-[#374151] dark:bg-[#111827]"
      role="status"
      aria-live="polite"
      aria-label={`${label} ${Math.round(p)} percent`}
    >
      <div className="flex items-center gap-3">
        <LoadingSpinner size="sm" label={label} className="text-brand-primary dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{Math.round(p)}% complete</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-[#1F2937]">
        <div
          className="h-full rounded-full bg-brand-primary transition-all duration-300 ease-out dark:bg-red-500"
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  )
}
