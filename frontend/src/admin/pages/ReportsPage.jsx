import { useEffect, useState } from 'react'
import { api, apiBlob } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from '../components/AdminUi.jsx'

function fieldToInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return x.toISOString().slice(0, 10)
}

function IconCsv({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  )
}

function IconPdf({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 3v6h6M9 13h6M9 17h4" />
    </svg>
  )
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function defaultExportFilename(from, to, ext) {
  const a = (from || 'from').replaceAll(/[^\d-]/g, '')
  const b = (to || 'to').replaceAll(/[^\d-]/g, '')
  return `financial-summary_${a}_${b}.${ext}`
}

export default function ReportsPage() {
  const { showToast } = useToast()
  const [from, setFrom] = useState(() => fieldToInputDate(new Date(Date.now() - 90 * 86400000)))
  const [to, setTo] = useState(() => fieldToInputDate(new Date()))
  const [summary, setSummary] = useState(null)
  const [period, setPeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exportingKind, setExportingKind] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (from) q.set('from', from)
      if (to) q.set('to', to)
      const res = await api(`/reports/summary?${q}`)
      setSummary(res.summary)
      setPeriod(res.period)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const fmtMoney = (n) =>
    typeof n === 'number' ? `₱${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'

  const exportDisabled = loading || exportingKind !== null || !from || !to

  const runExport = async (kind) => {
    if (!from || !to) {
      showToast('Select both from and to dates before exporting.', 'error')
      return
    }
    setExportingKind(kind)
    try {
      const q = new URLSearchParams()
      q.set('from', from)
      q.set('to', to)
      const path = kind === 'csv' ? `/reports/export/csv?${q}` : `/reports/export/pdf?${q}`
      const accept = kind === 'csv' ? 'text/csv,*/*' : 'application/pdf,*/*'
      const blob = await apiBlob(path, { accept })
      const ext = kind === 'csv' ? 'csv' : 'pdf'
      triggerDownload(blob, defaultExportFilename(from, to, ext))
      showToast(kind === 'csv' ? 'CSV report downloaded.' : 'PDF report downloaded.', 'success')
    } catch (e) {
      showToast(e.message || 'Export failed.', 'error')
    } finally {
      setExportingKind(null)
    }
  }

  const allZero =
    summary &&
    !summary.applications_submitted &&
    !summary.loans_disbursed &&
    !Number(summary.principal_disbursed) &&
    !Number(summary.collections)

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <h1 className={admin.pageTitle}>Reports</h1>
        <p className={admin.pageSubtitle}>
          Financial summary for the selected period — server-side CSV and PDF exports match dashboard metrics.
        </p>
      </div>

      <div className={`flex flex-wrap items-end gap-3 p-4 sm:p-6 ${admin.cardNoHover}`}>
        <div>
          <label className={`block text-xs font-medium ${admin.textMuted}`} htmlFor="rep-from">
            From
          </label>
          <input
            id="rep-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 ${admin.input}`}
          />
        </div>
        <div>
          <label className={`block text-xs font-medium ${admin.textMuted}`} htmlFor="rep-to">
            To
          </label>
          <input
            id="rep-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 ${admin.input}`}
          />
        </div>
        <button type="button" onClick={load} disabled={loading} className={admin.btnPrimary}>
          {loading ? 'Loading…' : 'Apply Date Range'}
        </button>
        <button
          type="button"
          onClick={() => runExport('csv')}
          disabled={exportDisabled}
          title={exportDisabled ? 'Set dates and wait for data to load' : 'Download UTF-8 CSV'}
          className={`${admin.btnSecondary} inline-flex min-h-[2.5rem] items-center justify-center gap-2 sm:min-w-[9rem]`}
        >
          <IconCsv className="h-4 w-4 shrink-0 opacity-80" />
          {exportingKind === 'csv' ? 'Exporting…' : 'Export CSV'}
        </button>
        <button
          type="button"
          onClick={() => runExport('pdf')}
          disabled={exportDisabled}
          title={exportDisabled ? 'Set dates and wait for data to load' : 'Download PDF'}
          className={`${admin.btnSecondary} inline-flex min-h-[2.5rem] items-center justify-center gap-2 sm:min-w-[9rem]`}
        >
          <IconPdf className="h-4 w-4 shrink-0 opacity-80" />
          {exportingKind === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {period && (
        <p className={`text-xs ${admin.textMuted}`}>
          Period: {new Date(period.from).toLocaleString()} — {new Date(period.to).toLocaleString()}
        </p>
      )}

      {allZero && !loading && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          No activity in this range — exports will still include zeros and full report headers for your records.
        </p>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className={`${admin.cardNoHover} animate-pulse p-6`}>
              <div className="h-3 w-28 rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-4 h-8 w-24 rounded bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Applications submitted', summary?.applications_submitted],
            ['Loans disbursed', summary?.loans_disbursed],
            ['Principal disbursed', fmtMoney(summary?.principal_disbursed)],
            ['Collections', fmtMoney(summary?.collections)],
          ].map(([label, val]) => (
            <div key={label} className={`${admin.card} p-6`}>
              <p className={`text-sm font-medium ${admin.textMuted}`}>{label}</p>
              <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs ${admin.textMuted}`}>
        Exports call{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-700 dark:bg-[#111827] dark:text-gray-400">
          GET /reports/export/csv
        </code>{' '}
        and{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-700 dark:bg-[#111827] dark:text-gray-400">
          GET /reports/export/pdf
        </code>{' '}
        with the same <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">from</code> /{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">to</code> filters as the summary API (admin permission{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">reports.view</code>).
      </p>
    </div>
  )
}
