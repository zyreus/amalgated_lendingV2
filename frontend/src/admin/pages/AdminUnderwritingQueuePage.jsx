import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin, EmptyTableRow, TableSkeletonRows } from '../components/AdminUi.jsx'

function riskPillClass(riskLevel) {
  const r = String(riskLevel || '').toLowerCase()
  if (r === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
  if (r === 'medium') return 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200'
  if (r === 'low') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200'
  return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
}

function riskShortLabel(risk) {
  const r = String(risk || '').toLowerCase()
  if (r === 'medium') return 'Med'
  if (r === 'low') return 'Low'
  if (r === 'high') return 'High'
  return risk || '—'
}

function openPath(row) {
  if (row?.kind === 'document' && row.document_loan_application_id) {
    return `/admin/document-loan-applications/${row.document_loan_application_id}`
  }
  if (row?.loan_id) return `/admin/loans/${row.loan_id}`
  return '/admin/loans'
}

const FILTER_OPTIONS = ['All', 'Needs stip', 'Fraud flag', 'Auto path', 'In review']

export default function AdminUnderwritingQueuePage() {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('All')

  const loadPendingLoansFallback = async () => {
    const q = new URLSearchParams({ status: 'pending', per_page: '50' })
    const res = await api(`/loans?${q}`)
    const list = res?.data?.data || []
    return (Array.isArray(list) ? list : []).map((loan) => {
      const borrower = loan?.borrower || {}
      const payload = loan?.application_payload || {}
      const slug = payload?.loan_product_slug || loan?.loan_product_slug || ''
      return {
        kind: 'loan',
        id: loan.id,
        application_ref: loan.loan_number || `LN-${String(loan.id).padStart(6, '0')}`,
        loan_id: loan.id,
        document_loan_application_id: null,
        borrower: {
          id: borrower.id,
          name: borrower.name,
          email: borrower.email,
          credit_score: borrower.credit_score ?? null,
          risk_level: borrower.risk_level ?? null,
        },
        product: slug ? slug.replace(/[-_]/g, ' ') : '—',
        risk: borrower.risk_level || '—',
        status: loan.status,
        underwriting_status: 'In review',
        sla_label: '—',
        sla_overdue: false,
      }
    })
  }

  const load = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ per_page: '50' })
      const res = await api(`/underwriting-queue?${q}`)
      setRows(Array.isArray(res?.data) ? res.data : [])
    } catch (e) {
      if (e?.status === 404) {
        try {
          const fallback = await loadPendingLoansFallback()
          setRows(fallback)
          showToast(
            'Underwriting API route not found (stale route cache?). Showing pending loans. Run: npm run api:clear',
            'error',
          )
          return
        } catch (fallbackErr) {
          showToast(fallbackErr.message, 'error')
        }
      } else {
        showToast(e.message, 'error')
      }
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filteredRows = useMemo(() => {
    if (filter === 'All') return rows
    return rows.filter((r) => String(r.underwriting_status || '') === filter)
  }, [rows, filter])

  return (
    <div className={`${admin.pageContainer} space-y-6`}>
      <div>
        <h1 className={admin.pageTitle}>Underwriting queue</h1>
        <p className={admin.pageSubtitle}>
          Borrower-submitted applications awaiting review. New portal and document-based applications appear here
          automatically with live status.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              f === filter
                ? `${admin.filterActive} rounded-full px-4 py-2 text-sm font-semibold`
                : `${admin.filterInactive} rounded-full px-4 py-2 text-sm font-semibold`
            }
          >
            {f}
          </button>
        ))}
        <button type="button" onClick={load} className={`${admin.btnSecondary} ml-auto`}>
          Refresh
        </button>
      </div>

      <div className={admin.tableWrap}>
        <div className={admin.tableScroll}>
          <table className={`${admin.tableBase} ${admin.tableMin900}`}>
            <thead className={admin.thead}>
              <tr>
                <th className={admin.tableCell}>Application</th>
                <th className={admin.tableCell}>Borrower</th>
                <th className={admin.tableCell}>Product</th>
                <th className={admin.tableCell}>Score</th>
                <th className={admin.tableCell}>Risk</th>
                <th className={admin.tableCell}>Status</th>
                <th className={admin.tableCell}>SLA</th>
                <th className={`${admin.tableCell} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableSkeletonRows cols={8} rows={6} />
              ) : filteredRows.length === 0 ? (
                <EmptyTableRow colSpan={8} message="No applications awaiting underwriting." />
              ) : (
                filteredRows.map((r) => {
                  const borrower = r.borrower || {}
                  const rowKey = `${r.kind}-${r.id}`
                  return (
                    <tr key={rowKey} className={admin.tbodyRow}>
                      <td className={`${admin.tableCell} ${admin.tableText} font-mono text-xs`}>
                        <Link
                          to={openPath(r)}
                          className="font-semibold text-red-600 hover:underline dark:text-red-400"
                        >
                          {r.application_ref || `#${r.id}`}
                        </Link>
                        {r.kind === 'document' ? (
                          <span className={`mt-0.5 block text-[10px] ${admin.tableMuted}`}>Document app</span>
                        ) : null}
                      </td>
                      <td className={`${admin.tableCell} ${admin.tableText}`}>
                        {borrower.id ? (
                          <Link
                            to={`/admin/borrowers/${borrower.id}`}
                            className="font-medium text-red-600 hover:underline dark:text-red-400"
                          >
                            {borrower.name || '—'}
                          </Link>
                        ) : (
                          borrower.name || '—'
                        )}
                      </td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>{r.product || '—'}</td>
                      <td className={`${admin.tableCell} ${admin.tableText} tabular-nums`}>
                        {borrower.credit_score != null && Number.isFinite(Number(borrower.credit_score))
                          ? Number(borrower.credit_score).toFixed(0)
                          : '—'}
                      </td>
                      <td className={admin.tableCell}>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskPillClass(r.risk)}`}>
                          {riskShortLabel(r.risk)}
                        </span>
                      </td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>
                        {r.underwriting_status || r.status || '—'}
                      </td>
                      <td className={`${admin.tableCell} ${admin.tableMuted}`}>
                        <span className={r.sla_overdue ? 'font-semibold text-red-700 dark:text-red-300' : undefined}>
                          {r.sla_label || '—'}
                        </span>
                      </td>
                      <td className={`${admin.tableCell} text-right`}>
                        <Link
                          to={openPath(r)}
                          className="text-sm font-semibold text-brand-primary hover:underline dark:text-brand-accent"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
