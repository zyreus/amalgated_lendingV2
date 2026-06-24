import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'

export default function SettingsBreadcrumb({ items = [] }) {
  const trail = [{ label: 'Settings', to: '/admin/settings' }, ...items]

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {trail.map((item, i) => {
        const isLast = i === trail.length - 1
        return (
          <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" aria-hidden /> : null}
            {isLast || !item.to ? (
              <span className="font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
            ) : (
              <Link to={item.to} className="text-gray-500 transition hover:text-brand-primary dark:text-gray-400">
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export function SettingsPageHeader({ title, subtitle }) {
  return (
    <div className="mb-6 min-w-0">
      <h1 className={admin.pageTitle}>{title}</h1>
      {subtitle ? <p className={admin.pageSubtitle}>{subtitle}</p> : null}
    </div>
  )
}
