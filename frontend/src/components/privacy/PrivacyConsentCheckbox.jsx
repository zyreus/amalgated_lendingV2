import { Link } from 'react-router-dom'

export default function PrivacyConsentCheckbox({
  checked,
  onChange,
  onOpenPolicy,
  error,
  className = '',
}) {
  return (
    <div className={className}>
      <label
        className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 ${
          checked ? 'border-emerald-300 bg-emerald-50/70' : 'border-black/10 bg-black/[0.02]'
        }`}
      >
        <input
          type="checkbox"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          aria-describedby={error ? 'privacy-consent-error' : undefined}
          className="mt-1 h-4 w-4 rounded border-black/30 text-red-600 focus:ring-red-500"
        />
        <span className="text-sm text-black/80">
          I have read and agree to the{' '}
          <button type="button" onClick={onOpenPolicy} className="font-semibold text-red-600 underline underline-offset-2 hover:text-red-700">
            Privacy Policy
          </button>{' '}
          and consent to the collection, processing, and sharing of my personal information as described.
          <span className="ml-1">
            (<Link to="/privacy-policy" target="_blank" className="text-red-600 underline underline-offset-2">open full page</Link>)
          </span>
        </span>
      </label>
      {error ? (
        <p id="privacy-consent-error" className="mt-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
