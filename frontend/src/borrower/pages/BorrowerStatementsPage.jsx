import { useEffect, useState } from 'react'
import axios from 'axios'
import PortalCard from '../../components/portal/PortalCard.jsx'
import { BorrowerPageHeader } from '../../components/portal/BorrowerPageHeader.jsx'
import { borrowerApi, getBorrowerToken } from '../api/client.js'
import { formatDate, formatPeso } from '../utils/formatters.js'
import { formatLaravelUnreachableError, laravelApiBases, laravelApiUrl } from '../../utils/lendingLaravelApi.js'

function StatementIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5M8.5 12h7M8.5 15.5h7M8.5 18.5h4" />
    </svg>
  )
}

function DownloadIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 19h14" />
    </svg>
  )
}

function EyeIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12 18 18.75 12 18.75 2.25 12 2.25 12Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
  )
}

function EmptyIllustration() {
  return (
    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
      <StatementIcon className="h-8 w-8" />
    </div>
  )
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <tr key={i} className="animate-pulse border-b border-red-50/80 last:border-0 dark:border-white/10">
          <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-32 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-28 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-28 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-24 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4"><div className="h-4 w-20 rounded bg-red-100/80 dark:bg-white/10" /></td>
          <td className="px-5 py-4 text-right"><div className="ml-auto h-9 w-28 rounded-full bg-red-100/80 dark:bg-white/10" /></td>
        </tr>
      ))}
    </>
  )
}

async function errorMessageFromBlob(blob, fallback) {
  try {
    const text = await blob.text()
    const json = JSON.parse(text)
    return json?.message || json?.error || fallback
  } catch {
    return fallback
  }
}

function filenameFromDisposition(header, fallback) {
  const match = String(header || '').match(/filename="?([^"]+)"?/i)
  return match?.[1] || fallback
}

async function downloadStatementPdf(statement) {
  const token = getBorrowerToken()
  const rel = `/borrower/statements/${statement.id}/download`
  let lastError = null

  for (const base of laravelApiBases()) {
    try {
      const response = await axios.get(laravelApiUrl(rel, base), {
        headers: {
          Accept: 'application/pdf',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        responseType: 'blob',
        validateStatus: () => true,
        timeout: 120000,
      })

      if (response.status >= 200 && response.status < 300) {
        const blob = new Blob([response.data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filenameFromDisposition(
          response.headers?.['content-disposition'],
          `Loan-Statement-${statement.loan_account_no || statement.id}.pdf`,
        )
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        return
      }

      lastError = new Error(await errorMessageFromBlob(response.data, `Download failed (HTTP ${response.status}).`))
      if (response.status !== 404 && response.status < 500) break
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(lastError?.message || formatLaravelUnreachableError(lastError))
}

function StatementMobileCard({ statement, downloadingId, viewingId, onDownload, onView }) {
  const isDownloading = downloadingId === statement.id
  const isViewing = viewingId === statement.id

  return (
    <article className="rounded-2xl border border-red-100/80 bg-white/90 p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#111827]/80 sm:hidden">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
          <StatementIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-brand-text dark:text-white">{statement.period_label || statement.period || '-'}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{statement.statement_type || 'Loan statement'}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Loan Account</dt>
          <dd className="mt-1 font-mono text-brand-text dark:text-white">{statement.loan_account_no || '-'}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</dt>
          <dd className="mt-1 text-brand-text dark:text-white">{formatDate(statement.due_date)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Remaining Balance</dt>
          <dd className="mt-1 text-base font-bold text-brand-primary">{formatPeso(statement.remaining_balance)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Due</dt>
          <dd className="mt-1 font-bold text-brand-primary">{formatPeso(statement.total_due ?? statement.monthly_due)}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status</dt>
          <dd className="mt-1 capitalize text-brand-text dark:text-white">{String(statement.status || 'ready').replace(/_/g, ' ')}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onView(statement)}
          disabled={isViewing}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-primary/25 bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#111827]"
        >
          <EyeIcon />
          {isViewing ? 'Opening...' : 'View'}
        </button>
        <button
          type="button"
          onClick={() => onDownload(statement)}
          disabled={isDownloading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <DownloadIcon />
          {isDownloading ? 'Preparing...' : 'PDF'}
        </button>
      </div>
    </article>
  )
}

export default function BorrowerStatementsPage() {
  const [statements, setStatements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [downloadingId, setDownloadingId] = useState(null)
  const [viewingId, setViewingId] = useState(null)
  const [selectedStatement, setSelectedStatement] = useState(null)

  const loadStatements = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await borrowerApi('/borrower/statements')
      setStatements(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      setError(err.message || 'Could not load statements.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await borrowerApi('/borrower/statements')
        if (mounted) setStatements(Array.isArray(res?.data) ? res.data : [])
      } catch (err) {
        if (mounted) setError(err.message || 'Could not load statements.')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleDownload = async (statement) => {
    setDownloadingId(statement.id)
    setError('')
    try {
      await downloadStatementPdf(statement)
      await loadStatements()
    } catch (err) {
      setError(err.message || 'Could not download statement PDF.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleView = async (statement) => {
    setViewingId(statement.id)
    setError('')
    try {
      const res = await borrowerApi(`/borrower/statements/${statement.id}`)
      const viewed = res?.data || statement
      setSelectedStatement(viewed)
      setStatements((items) => items.map((item) => (item.id === viewed.id ? { ...item, ...viewed } : item)))
    } catch (err) {
      setError(err.message || 'Could not open statement.')
    } finally {
      setViewingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <BorrowerPageHeader
        eyebrow="Documents"
        title="Statements & certificates"
        description="View due dates, balances, penalties, payment status, and download your monthly Statement of Account."
      />

      <PortalCard
        title="Monthly statements"
        subtitle="Borrower-only SOA records generated from your active loan records."
        className="bg-gradient-to-br from-white via-[#fffaf0] to-[#fff4e4] dark:from-[#111827] dark:via-[#111827] dark:to-[#160f12]"
      >
        {error ? (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadStatements}
              className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold transition hover:bg-red-100 dark:border-red-400/40 dark:hover:bg-red-500/10"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="hidden overflow-hidden rounded-2xl border border-red-100/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-[#0F172A]/70 sm:block">
          <div className="overflow-x-auto">
            <table className="min-w-[820px] w-full text-left text-sm">
              <thead className="bg-[#fff7e8] text-xs font-semibold uppercase tracking-wider text-gray-500 dark:bg-[#1f1720] dark:text-gray-400">
                <tr>
                  <th className="px-5 py-4">Period</th>
                  <th className="px-5 py-4">Statement Type</th>
                  <th className="px-5 py-4">Loan Account</th>
                  <th className="px-5 py-4">Remaining Balance</th>
                  <th className="px-5 py-4">Total Due</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Due Date</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-50/90 dark:divide-white/10">
                {loading ? <SkeletonRows /> : null}
                {!loading && statements.map((statement) => {
                  const isDownloading = downloadingId === statement.id
                  return (
                    <tr key={statement.id} className="bg-white/70 transition duration-300 hover:bg-red-50/70 dark:bg-transparent dark:hover:bg-white/5">
                      <td className="px-5 py-4 font-semibold text-brand-text dark:text-white">{statement.period_label || statement.period || '-'}</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 text-gray-700 dark:text-gray-300">
                          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                            <StatementIcon className="h-4 w-4" />
                          </span>
                          {statement.statement_type || 'Loan statement'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono text-gray-700 dark:text-gray-300">{statement.loan_account_no || '-'}</td>
                      <td className="px-5 py-4 font-bold text-brand-primary">{formatPeso(statement.remaining_balance)}</td>
                      <td className="px-5 py-4 font-bold text-brand-primary">{formatPeso(statement.total_due ?? statement.monthly_due)}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold capitalize text-brand-primary dark:bg-red-500/10 dark:text-red-200">
                          {String(statement.status || 'ready').replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-700 dark:text-gray-300">{formatDate(statement.due_date)}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleView(statement)}
                            disabled={viewingId === statement.id}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-primary/25 bg-white px-4 py-2 text-xs font-semibold text-brand-primary shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-primary hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#111827]"
                          >
                            <EyeIcon />
                            {viewingId === statement.id ? 'Opening...' : 'View'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(statement)}
                            disabled={isDownloading}
                            className="inline-flex items-center justify-center gap-2 rounded-full border border-brand-primary/25 bg-white px-4 py-2 text-xs font-semibold text-brand-primary shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-brand-primary hover:bg-brand-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-[#111827]"
                          >
                            <DownloadIcon />
                            {isDownloading ? 'Preparing...' : 'PDF'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4 sm:hidden">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-red-100/70 dark:bg-white/10" />
            ))
          ) : (
            statements.map((statement) => (
              <StatementMobileCard
                key={statement.id}
                statement={statement}
                downloadingId={downloadingId}
                viewingId={viewingId}
                onDownload={handleDownload}
                onView={handleView}
              />
            ))
          )}
        </div>

        {!loading && statements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-red-200 bg-white/70 px-6 py-12 text-center dark:border-red-500/25 dark:bg-white/5">
            <EmptyIllustration />
            <h3 className="mt-4 text-base font-semibold text-brand-text dark:text-white">No statements available yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              Your loan statements will appear here once they are generated for your borrower account.
            </p>
          </div>
        ) : null}
      </PortalCard>

      {selectedStatement ? (
        <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="borrower-statement-title">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 border-t-[3px] border-t-brand-primary bg-white p-6 shadow-2xl dark:border-[#1F2937] dark:border-t-brand-primary dark:bg-[#111827]">
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 pb-4 dark:border-[#1F2937]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">Statement of account</p>
                <h2 id="borrower-statement-title" className="mt-1 text-xl font-semibold text-brand-text dark:text-white">
                  {selectedStatement.statement_number || selectedStatement.period_label}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedStatement.loan_account_no || '-'}</p>
              </div>
              <button type="button" onClick={() => setSelectedStatement(null)} className="rounded-full border border-red-100 px-4 py-2 text-sm font-semibold text-brand-primary hover:bg-red-50 dark:border-white/10 dark:hover:bg-white/5">
                Close
              </button>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Period', selectedStatement.period_label || selectedStatement.period],
                ['Due Date', formatDate(selectedStatement.due_date)],
                ['Monthly Due', formatPeso(selectedStatement.monthly_due)],
                ['Penalties', formatPeso(selectedStatement.penalties)],
                ['Total Due', formatPeso(selectedStatement.total_due ?? selectedStatement.monthly_due)],
                ['Remaining Balance', formatPeso(selectedStatement.remaining_balance)],
                ['Viewed', selectedStatement.viewed_at ? formatDate(selectedStatement.viewed_at) : 'Just now'],
                ['Downloaded', selectedStatement.downloaded_at ? formatDate(selectedStatement.downloaded_at) : 'Not downloaded'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-red-100/80 bg-red-50/40 p-4 dark:border-white/10 dark:bg-white/5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</dt>
                  <dd className="mt-1 font-semibold text-brand-text dark:text-white">{value || '-'}</dd>
                </div>
              ))}
            </dl>
            {Array.isArray(selectedStatement.payment_history) && selectedStatement.payment_history.length ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-red-100/80 dark:border-white/10">
                <div className="bg-red-50/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  Payment Details
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-[620px] w-full text-left text-xs">
                    <thead className="bg-white text-gray-500 dark:bg-[#0F172A] dark:text-gray-400">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">OR Number</th>
                        <th className="px-4 py-3">AR Number</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-50 dark:divide-white/10">
                      {selectedStatement.payment_history.map((payment) => (
                        <tr key={payment.id || `${payment.installment_no}-${payment.due_date}`}>
                          <td className="px-4 py-3">{formatDate(payment.paid_at || payment.due_date)}</td>
                          <td className="px-4 py-3 font-semibold">{formatPeso(payment.amount_paid)}</td>
                          <td className="px-4 py-3 font-mono">{payment.official_receipt_number || payment.or_number || '—'}</td>
                          <td className="px-4 py-3 font-mono">{payment.acknowledgement_receipt_number || payment.ar_number || '—'}</td>
                          <td className="px-4 py-3 capitalize">{String(payment.status || 'pending').replace(/_/g, ' ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => handleDownload(selectedStatement)}
              disabled={downloadingId === selectedStatement.id}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <DownloadIcon />
              {downloadingId === selectedStatement.id ? 'Preparing...' : 'Download PDF'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
