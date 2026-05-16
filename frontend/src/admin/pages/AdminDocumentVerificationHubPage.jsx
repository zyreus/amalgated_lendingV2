import { Link } from 'react-router-dom'
import { admin } from '../components/AdminUi.jsx'

const queues = [
  { title: 'Document loan applications', desc: 'Structured PDF / e-form pipeline', to: '/admin/document-loan-applications', badge: 'Primary' },
  { title: 'Travel loan applications', desc: 'Specialized travel underwriting', to: '/admin/travel-loans', badge: 'Specialty' },
  { title: 'General applications', desc: 'Core lending queue', to: '/admin/loans', badge: 'Core' },
]

export default function AdminDocumentVerificationHubPage() {
  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Document verification</h1>
        <p className={admin.pageSubtitle}>Route uploads to the right review surface. OCR and fraud scoring hook in at the API layer.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {queues.map((q) => (
          <Link key={q.to} to={q.to} className={`${admin.card} group block no-underline`}>
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600 dark:bg-[#1F2937] dark:text-gray-300">
                {q.badge}
              </span>
              <span className="text-sm font-semibold text-[#E63946] transition group-hover:translate-x-0.5 dark:text-[#FF6B6B]">Open →</span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-gray-100">{q.title}</h2>
            <p className={`mt-2 text-sm ${admin.textMuted}`}>{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className={`${admin.cardNoHover}`}>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fraud &amp; OCR checklist</h3>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>Template match for national ID dimensions and hologram markers.</li>
          <li>Cross-check employer hotline for income calls &gt; ₱80k monthly.</li>
          <li>Velocity: same device hash across 3+ applications in 24h.</li>
        </ul>
      </div>
    </div>
  )
}
