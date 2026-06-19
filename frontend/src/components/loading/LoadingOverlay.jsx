import LoadingSpinner from './LoadingSpinner.jsx'

/**
 * Blocks interaction on a container (form, panel, modal body) while processing.
 */
export default function LoadingOverlay({
  show = false,
  label = 'Processing...',
  className = '',
  blur = true,
}) {
  if (!show) return null

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[inherit] ${
        blur ? 'bg-white/75 backdrop-blur-[2px] dark:bg-[#0F172A]/80' : 'bg-white/90 dark:bg-[#0F172A]/90'
      } ${className}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <LoadingSpinner size="lg" label={label} className="text-brand-primary dark:text-red-400" />
      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">{label}</p>
    </div>
  )
}
