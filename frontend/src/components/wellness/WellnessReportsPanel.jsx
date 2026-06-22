import { useState } from 'react'
import { api } from '../../admin/api/client.js'
import { admin } from '../../admin/components/AdminUi.jsx'

const REPORT_TYPES = [
  { id: 'portfolio', label: 'Portfolio overview', desc: 'Full portfolio wellness snapshot' },
  { id: 'risk-trends', label: 'Risk analysis & trends', desc: 'Segment distribution and improving borrowers' },
  { id: 'delayed-payments', label: 'Collection risk report', desc: 'Delayed accounts and overdue analysis' },
  { id: 'borrower', label: 'Borrower wellness report', desc: 'All borrowers ranked by wellness score' },
]

export default function WellnessReportsPanel({ roleLabel = 'Admin' }) {
  const [loading, setLoading] = useState(null)
  const [lastReport, setLastReport] = useState(null)

  const downloadReport = async (type) => {
    setLoading(type)
    try {
      const res = await api(`/credit-wellness/reports/${type}`)
      if (res?.ok) {
        setLastReport({ type, data: res.data, at: new Date().toISOString() })
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `wellness-${type}-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <section className={admin.cardNoHover}>
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Wellness reports — {roleLabel}</h2>
      <p className={`mt-1 text-xs ${admin.textMuted}`}>Export JSON reports for analysis and compliance</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {REPORT_TYPES.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={loading === r.id}
            onClick={() => downloadReport(r.id)}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-brand-primary/30 hover:shadow-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-brand-primary/40"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.label}</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.desc}</p>
            <span className="mt-2 inline-block text-xs font-semibold text-brand-primary">
              {loading === r.id ? 'Generating…' : 'Download →'}
            </span>
          </button>
        ))}
      </div>
      {lastReport ? (
        <p className={`mt-3 text-xs ${admin.textMuted}`}>
          Last export: {lastReport.type} at {new Date(lastReport.at).toLocaleString()}
        </p>
      ) : null}
    </section>
  )
}
