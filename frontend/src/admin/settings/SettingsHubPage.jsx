import { Link } from 'react-router-dom'
import { ChevronRight, Lock } from 'lucide-react'
import { admin } from '../components/AdminUi.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { SETTINGS_CATEGORIES } from './settingsNavConfig.js'
import { canAccessSettingsCategory, isSettingsCategoryReadOnly } from './settingsPermissions.js'

export default function SettingsHubPage() {
  const { can } = useAdminApiAuth()

  return (
    <div className="min-w-0">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SETTINGS_CATEGORIES.map((cat) => {
          const allowed = canAccessSettingsCategory(can, cat.id)
          const readOnly = allowed && isSettingsCategoryReadOnly(can, cat.id)
          const CardTag = allowed ? Link : 'div'

          return (
            <CardTag
              key={cat.id}
              {...(allowed ? { to: cat.to } : {})}
              className={`${admin.cardNoHover} group flex flex-col gap-3 transition ${
                allowed
                  ? 'hover:border-brand-primary/30 hover:shadow-lg'
                  : 'opacity-75'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                    allowed
                      ? 'border-red-100 bg-red-50 text-brand-primary dark:border-red-900/40 dark:bg-red-950/30'
                      : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-[#1F2937] dark:bg-[#1F2937]'
                  }`}
                >
                  {allowed ? <cat.icon className="h-5 w-5" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                </span>
                {allowed ? (
                  <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-brand-primary" />
                ) : null}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{cat.label}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${admin.textMuted}`}>{cat.description}</p>
              </div>
              {readOnly ? (
                <p className="text-xs font-medium text-sky-600 dark:text-sky-400">View only — no edit permission</p>
              ) : null}
              {!allowed ? (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Restricted — ask Super Admin for access</p>
              ) : null}
            </CardTag>
          )
        })}
      </div>

      <div className={`${admin.cardNoHover} mt-6`}>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick links</h2>
        <p className={`mt-1 text-xs ${admin.textMuted}`}>Jump to related admin pages without leaving the platform.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { label: 'Loan Products', to: '/admin/loan-products' },
            { label: 'Users', to: '/admin/users' },
            { label: 'Activity Logs', to: '/admin/activity' },
            { label: 'Printable Forms', to: '/admin/printable-forms' },
          ].map((link) => (
            <Link key={link.to} to={link.to} className={admin.btnSecondary}>
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
