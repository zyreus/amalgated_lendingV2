import LoadingOverlay from './LoadingOverlay.jsx'

/**
 * Relative wrapper for forms/panels — shows overlay while submitting.
 */
export default function FormLoadingOverlay({ submitting = false, label = 'Saving...', children, className = '' }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      <LoadingOverlay show={submitting} label={label} />
    </div>
  )
}
