import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'

/** Input/select classes with read-only and disabled states for settings forms. */
export const settingsInputClass = `${admin.input} disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 dark:disabled:bg-[#0F172A]/60`

export function ToggleSwitch({ label, value, onChange, helper, disabled }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        {helper ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{helper}</p> : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
          value ? 'bg-brand-primary' : 'bg-gray-300 dark:bg-white/15'
        }`}
        aria-pressed={value}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export function FieldLabel({ label, helper, htmlFor, error }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      {helper ? <span className={`mt-0.5 block text-xs ${admin.textMuted}`}>{helper}</span> : null}
      {error ? <span className="mt-0.5 block text-xs text-red-600 dark:text-red-400">{error}</span> : null}
    </label>
  )
}

export function SectionCard({ id, title, icon: Icon, subtitle, children, right, defaultOpen = true }) {
  return (
    <section id={id} className={`${admin.cardNoHover} scroll-mt-28`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {Icon ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-red-50 text-brand-primary dark:border-[#1F2937] dark:bg-red-950/30">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              {subtitle ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{subtitle}</p> : null}
            </div>
          </div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {defaultOpen ? <div className="mt-5 space-y-4">{children}</div> : null}
    </section>
  )
}

export function SettingsAccordion({ title, subtitle, icon: Icon, children, defaultOpen = false }) {
  return (
    <details
      className={`${admin.cardNoHover} group scroll-mt-28`}
      open={defaultOpen || undefined}
    >
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {Icon ? (
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-800 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-100">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
              {subtitle ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{subtitle}</p> : null}
            </div>
          </div>
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 transition group-open:rotate-180 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-400">
            <ChevronDown className="h-4 w-4" aria-hidden />
          </span>
        </div>
      </summary>
      <div className="mt-5 space-y-4 border-t border-gray-100 pt-5 dark:border-[#1F2937]">{children}</div>
    </details>
  )
}

export function SettingsLinkCard({ label, description, to }) {
  return (
    <Link
      to={to}
      className={`${admin.cardNoHover} flex items-center justify-between gap-3 transition hover:border-brand-primary/30 hover:shadow-lg`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {description ? <p className={`mt-0.5 text-xs ${admin.textMuted}`}>{description}</p> : null}
      </div>
      <span className="text-xs font-medium text-brand-primary">Open →</span>
    </Link>
  )
}
