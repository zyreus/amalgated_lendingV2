import { admin } from '../../components/AdminUi.jsx'

/**
 * Accessible form field with label, helper, validation error, and optional hint badge.
 */
export default function SettingsField({
  label,
  helper,
  htmlFor,
  error,
  required,
  children,
  className = '',
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={htmlFor} className="block">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
          {required ? (
            <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950/40 dark:text-red-300">
              Required
            </span>
          ) : null}
        </span>
        {helper ? <span className={`mt-1 block text-xs leading-relaxed ${admin.textMuted}`}>{helper}</span> : null}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400" role="alert">
          <span aria-hidden>⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  )
}
