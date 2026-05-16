import { Link } from 'react-router-dom'
import { admin } from '../components/AdminUi.jsx'

const buckets = [
  { name: 'Current (0–29 DPD)', count: 842, color: 'from-emerald-500/90 to-emerald-600' },
  { name: 'Early delinquency (30–59)', count: 36, color: 'from-amber-500/90 to-amber-600' },
  { name: 'Serious (60+)', count: 12, color: 'from-[#E63946] to-red-700' },
  { name: 'Legal / recovery', count: 3, color: 'from-slate-700 to-slate-900' },
]

export default function AdminCollectionsPipelinePage() {
  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Collections pipeline</h1>
        <p className={admin.pageSubtitle}>Portfolio buckets, promises to pay, and settlement workflows (illustrative).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {buckets.map((b) => (
          <div key={b.name} className={`${admin.cardNoHover} overflow-hidden bg-gradient-to-br p-0 text-white ${b.color}`}>
            <div className="p-5">
              <p className="text-sm font-medium text-white/90">{b.name}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight">{b.count}</p>
              <p className="mt-1 text-xs text-white/80">accounts</p>
            </div>
          </div>
        ))}
      </div>

      <div className={`${admin.cardNoHover} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Next actions</h2>
          <Link to="/admin/payments" className={`${admin.btnPrimary}`}>
            Payment console
          </Link>
        </div>
        <ul className="list-inside list-disc space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li>Send SMS cadence for bucket 30–59 (Twilio template v3).</li>
          <li>Review settlement offers over ₱100k with supervisor approval.</li>
          <li>Sync dialer disposition codes to CRM notes.</li>
        </ul>
      </div>
    </div>
  )
}
