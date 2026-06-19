import LoadingSpinner from './LoadingSpinner.jsx'
import { LOADING_LABELS } from './loadingLabels.js'

/**
 * Enterprise-style action button: disabled while busy, spinner + stable width.
 */
export default function LoadingButton({
  loading = false,
  loadingText,
  loadingKey,
  children,
  className = '',
  disabled = false,
  type = 'button',
  onClick,
  minWidth,
  spinnerSize = 'sm',
  ...rest
}) {
  const busy = Boolean(loading)
  const resolvedLoadingText =
    loadingText || (loadingKey && LOADING_LABELS[loadingKey]) || LOADING_LABELS.process
  const label = busy ? resolvedLoadingText : children

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      aria-disabled={disabled || busy || undefined}
      onClick={busy ? undefined : onClick}
      style={minWidth ? { minWidth } : undefined}
      className={`inline-flex items-center justify-center gap-2 transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...rest}
    >
      {busy ? <LoadingSpinner size={spinnerSize} label={resolvedLoadingText} /> : null}
      <span className={busy ? 'opacity-95' : undefined}>{label}</span>
    </button>
  )
}
