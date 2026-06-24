import { Eye } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'

export default function SettingsReadOnlyBanner() {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/50 dark:bg-amber-950/25"
      role="status"
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        <Eye className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">View-only access</p>
        <p className={`mt-0.5 text-xs leading-relaxed ${admin.textMuted}`}>
          You can review these settings but cannot save changes. Contact a Super Admin if you need edit access.
        </p>
      </div>
    </div>
  )
}
