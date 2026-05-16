import { admin } from '../components/AdminUi.jsx'

const items = [
  { title: 'AML screening', status: 'Pass', detail: 'Last batch: 02:00 UTC' },
  { title: 'KYC refresh policy', status: 'Due 12%', detail: 'Borrowers > 365d' },
  { title: 'Retention schedule', status: 'OK', detail: 'Docs 7y, logs 3y' },
  { title: 'Regulatory filings', status: 'Queued', detail: 'BSP report — May' },
]

export default function AdminComplianceCenterPage() {
  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Compliance center</h1>
        <p className={admin.pageSubtitle}>Control tower for policy packs, retention, and regulatory tasks (sample).</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className={admin.card}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{it.title}</p>
                <p className={`mt-1 text-sm ${admin.textMuted}`}>{it.detail}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200">{it.status}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={`${admin.insetPanel} text-sm text-gray-600 dark:text-gray-400`}>
        Wire this module to immutable audit logs, scheduled exports, and signed approval workflows. Activity logs live under{' '}
        <span className="font-semibold text-gray-900 dark:text-gray-200">System → Activity logs</span>.
      </div>
    </div>
  )
}
