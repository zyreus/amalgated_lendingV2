import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin } from '../components/AdminUi.jsx'
import CorporateLetterhead from '../../components/CorporateLetterhead.jsx'
import amalgatedLogo from '../../assets/amalgated-lending-logo.png'

function fieldToInputDate(d) {
  if (!d) return ''
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return ''
  return x.toISOString().slice(0, 10)
}

function IconPrint({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
      />
    </svg>
  )
}

function formatLongDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' })
}

function formatShortDateOnly(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { dateStyle: 'long' })
}

/** Chrome often ignores named @page when nested; inject default @page landscape only for this print job. */
const FINANCIAL_PRINT_PAGE_STYLE_ID = 'financial-report-print-page-size'

function injectFinancialPrintLandscapePage() {
  if (document.getElementById(FINANCIAL_PRINT_PAGE_STYLE_ID)) return
  const el = document.createElement('style')
  el.id = FINANCIAL_PRINT_PAGE_STYLE_ID
  el.textContent = '@media print { @page { size: A4 landscape; margin: 12mm; } }'
  document.head.appendChild(el)
}

function removeFinancialPrintLandscapePage() {
  document.getElementById(FINANCIAL_PRINT_PAGE_STYLE_ID)?.remove()
}

export default function ReportsPage() {
  const { showToast } = useToast()
  const { user } = useAdminApiAuth()
  const [from, setFrom] = useState(() => fieldToInputDate(new Date(Date.now() - 90 * 86400000)))
  const [to, setTo] = useState(() => fieldToInputDate(new Date()))
  const [summary, setSummary] = useState(null)
  const [period, setPeriod] = useState(null)
  const [loading, setLoading] = useState(true)
  const [printSubmitting, setPrintSubmitting] = useState(false)
  const [ledgerStamp, setLedgerStamp] = useState('')

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

  const printedByLine =
    user?.name?.trim() ||
    user?.username?.trim() ||
    user?.email?.trim() ||
    '—'

  const roleLine =
    Array.isArray(user?.roles) && user.roles.length > 0
      ? user.roles.map((r) => r.name || r.slug).join(', ')
      : user?.role
        ? String(user.role).replace(/_/g, ' ')
        : '—'

  const printDisabled = loading || printSubmitting || !from || !to || !summary

  const handlePrintReport = async () => {
    if (!from || !to) {
      showToast('Select both from and to dates before printing.', 'error')
      return
    }
    if (!summary) {
      showToast('Load the summary first using Apply Date Range.', 'error')
      return
    }
    setPrintSubmitting(true)
    try {
      await api('/reports/print-log', {
        method: 'POST',
        body: JSON.stringify({ from, to }),
      })
      flushSync(() => {
        setLedgerStamp(new Date().toLocaleString(undefined, { dateStyle: 'long', timeStyle: 'short' }))
      })
      injectFinancialPrintLandscapePage()
      const onAfterPrint = () => {
        removeFinancialPrintLandscapePage()
        window.removeEventListener('afterprint', onAfterPrint)
      }
      window.addEventListener('afterprint', onAfterPrint)
      requestAnimationFrame(() => {
        try {
          window.print()
        } catch {
          onAfterPrint()
        }
      })
    } catch (e) {
      showToast(e.message || 'Could not authorize print. Please try again.', 'error')
    } finally {
      setPrintSubmitting(false)
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
          Financial summary for the selected period. Use print for a controlled, audit-logged paper copy — no file
          downloads.
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
          onClick={handlePrintReport}
          disabled={printDisabled}
          title="Print current financial summary"
          className={`${admin.btnSecondary} inline-flex min-h-[2.5rem] items-center justify-center gap-2 sm:min-w-[10rem]`}
        >
          <IconPrint className="h-4 w-4 shrink-0 opacity-80" />
          {printSubmitting ? 'Preparing…' : 'Print Report'}
        </button>
      </div>

      {period && (
        <p className={`text-xs ${admin.textMuted}`}>
          Period: {new Date(period.from).toLocaleString()} — {new Date(period.to).toLocaleString()}
        </p>
      )}

      {allZero && !loading && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          No activity in this range — the printed report will still list zeros for your records.
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
        Printing records an activity log entry (<code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">POST /reports/print-log</code>) and requires permission{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-[10px]">reports.view</code>. Use your browser print dialog;
        enable headers and footers if you need automatic page numbers.
      </p>

      {/* Off-screen on screen; sole visible content when printing (see index.css @media print) */}
      <div id="financial-report-print-root" className="print-only-amalg financial-print-doc">
        <div className="financial-print-watermark" aria-hidden>
          CONFIDENTIAL
        </div>
        <header className="financial-print-header">
          <div className="financial-print-corp">
            <CorporateLetterhead logoSrc={amalgatedLogo} />
          </div>
          <h2 className="financial-print-title">Financial summary report</h2>
          <dl className="financial-print-meta">
            <div>
              <dt>Period covered</dt>
              <dd>
                {period ? `${formatShortDateOnly(period.from)} – ${formatShortDateOnly(period.to)}` : '—'}
              </dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{ledgerStamp || '—'}</dd>
            </div>
            <div>
              <dt>Printed by</dt>
              <dd>{printedByLine}</dd>
            </div>
            <div>
              <dt>Role / capacity</dt>
              <dd>{roleLine}</dd>
            </div>
          </dl>
        </header>

        <section className="financial-print-cards" aria-label="Summary metrics">
          {[
            ['Applications submitted', summary?.applications_submitted],
            ['Loans disbursed', summary?.loans_disbursed],
            ['Principal disbursed', fmtMoney(summary?.principal_disbursed)],
            ['Collections', fmtMoney(summary?.collections)],
          ].map(([label, val]) => (
            <div key={String(label)} className="financial-print-card">
              <p className="financial-print-card-label">{label}</p>
              <p className="financial-print-card-value">{val ?? '—'}</p>
            </div>
          ))}
        </section>

        <table className="financial-print-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col" className="financial-print-num">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Applications submitted</td>
              <td className="financial-print-num">{summary?.applications_submitted ?? '—'}</td>
            </tr>
            <tr>
              <td>Loans disbursed</td>
              <td className="financial-print-num">{summary?.loans_disbursed ?? '—'}</td>
            </tr>
            <tr>
              <td>Principal disbursed</td>
              <td className="financial-print-num">{fmtMoney(summary?.principal_disbursed)}</td>
            </tr>
            <tr>
              <td>Total collections</td>
              <td className="financial-print-num">{fmtMoney(summary?.collections)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="financial-print-tfoot">
                <p>
                  <strong>Confidential — internal use only.</strong> System-generated from live data for the period{' '}
                  {period ? `${formatLongDate(period.from)} through ${formatLongDate(period.to)}` : 'shown above'}.
                </p>
                <p className="financial-print-tfoot-sub">
                  This document is not a negotiable instrument. Retain according to your records retention policy. For
                  page numbers, use your browser&apos;s print option to include headers and footers.
                </p>
                <div className="financial-print-signature">
                  <p className="financial-print-signature-label">Authorized signature (optional)</p>
                  <div className="financial-print-signature-line" />
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <style>{`
        .financial-print-doc {
          position: relative;
          box-sizing: border-box;
          padding: 10mm 12mm 12mm;
          font-family: Inter, system-ui, sans-serif;
          font-size: 11pt;
          line-height: 1.45;
          color: #000;
          background: #fff;
        }
        .financial-print-watermark {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 48pt;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: #000;
          opacity: 0.05;
          transform: rotate(-32deg);
          pointer-events: none;
          user-select: none;
        }
        .financial-print-header {
          padding-bottom: 10pt;
          margin-bottom: 14pt;
        }
        .financial-print-corp {
          margin-bottom: 10pt;
        }
        .financial-print-title {
          margin: 0 0 10pt;
          font-size: 14pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #7f1d1d;
        }
        .financial-print-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8pt 16pt;
          margin: 0;
        }
        .financial-print-meta dt {
          margin: 0;
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #444;
        }
        .financial-print-meta dd {
          margin: 2pt 0 0;
          font-size: 10pt;
          font-weight: 600;
        }
        .financial-print-cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10pt;
          margin: 0 0 14pt;
          break-inside: avoid;
        }
        .financial-print-card {
          border: 1px solid #000;
          border-radius: 4pt;
          padding: 10pt 8pt;
          background: #fafafa;
        }
        .financial-print-card-label {
          margin: 0 0 6pt;
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #444;
        }
        .financial-print-card-value {
          margin: 0;
          font-size: 15pt;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }
        .financial-print-table {
          width: 100%;
          border-collapse: collapse;
          break-inside: auto;
        }
        .financial-print-table thead {
          display: table-header-group;
        }
        .financial-print-table tfoot {
          display: table-footer-group;
        }
        .financial-print-table th,
        .financial-print-table td {
          border: 1px solid #000;
          padding: 8pt 10pt;
          vertical-align: top;
        }
        .financial-print-table th {
          background: #f0f0f0;
          text-align: left;
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .financial-print-num {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .financial-print-tfoot {
          font-size: 9pt;
          line-height: 1.4;
          background: #fafafa;
        }
        .financial-print-tfoot p {
          margin: 0 0 6pt;
        }
        .financial-print-tfoot-sub {
          font-size: 8pt;
          color: #333;
        }
        .financial-print-signature {
          margin-top: 12pt;
          break-inside: avoid;
        }
        .financial-print-signature-label {
          margin: 0 0 4pt;
          font-size: 8pt;
          color: #333;
        }
        .financial-print-signature-line {
          max-width: 220pt;
          border-bottom: 1px solid #000;
          height: 28pt;
        }
        tr {
          break-inside: avoid;
          break-after: auto;
        }
      `}</style>
    </div>
  )
}
