import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { admin } from '../../components/AdminUi.jsx'

export default function SettingsAccessDenied({ title = 'Access restricted', message, backTo = '/admin/settings' }) {
  return (
    <div className={`${admin.cardNoHover} mx-auto max-w-lg text-center`}>
      <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-[#1F2937] dark:text-gray-400">
        <Lock className="h-5 w-5" aria-hidden />
      </span>
      <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className={`mt-2 text-sm leading-relaxed ${admin.textMuted}`}>
        {message || 'You do not have permission to view or edit this settings category. Contact a Super Admin to request access.'}
      </p>
      <Link to={backTo} className={`${admin.btnSecondary} mt-6 inline-flex`}>
        Back to Settings
      </Link>
    </div>
  )
}
