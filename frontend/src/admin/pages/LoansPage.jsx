import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { downloadCsv, openPrintPdf } from '../utils/export.js'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'

function formatLoanRateMonthly(loan) {
  const payloadRate = Number(loan?.selected_interest_rate ?? loan?.application_payload?.selected_interest_rate)
  if (Number.isFinite(payloadRate) && payloadRate > 0) {
    const suffix = loan?.selected_rate_type === 'monthly' || loan?.application_payload?.selected_rate_type === 'monthly' ? '%/mo' : '%'
    return `${payloadRate.toFixed(4)}${suffix}`
  }
  const annual = Number(loan?.annual_interest_rate)
  if (!Number.isFinite(annual) || annual <= 0) return '—'
  return `${(annual / 12).toFixed(4)}%/mo (~${annual.toFixed(2)}%/yr)`
}

export default function LoansPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [status, setStatus] = useState('pending')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '15' })
      if (status) q.set('status', status)
      if (search.trim()) q.set('search', search.trim())
      const res = await api(`/loans?${q}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [status])

  const rows = data?.data || []

  const exportRows = rows.map((loan) => [
    loan.id,
    loan.borrower?.name || '',
    loan.borrower?.email || '',
    loan.principal,
    loan.status,
    loan.term_months,
    formatLoanRateMonthly(loan),
    loan.created_at || '',
  ])

  const handleCsvExport = () => {
    const suffix = status || 'all'
    downloadCsv(
      `loans-${suffix}.csv`,
      ['ID', 'Borrower', 'Borrower Email', 'Principal', 'Status', 'Term (months)', 'Rate Monthly (%)', 'Created At'],
      exportRows,
    )
    showToast('Loans CSV downloaded.', 'success')
  }

  const handlePdfExport = () => {
    const subtitle = `Filter: ${status || 'all'}${search.trim() ? `, Search: ${search.trim()}` : ''}`
    const ok = openPrintPdf(
      'Loans Report',
      subtitle,
      ['ID', 'Borrower', 'Email', 'Principal', 'Status', 'Term', 'Rate'],
      rows.map((loan) => [
        `#${loan.id}`,
        loan.borrower?.name || '',
        loan.borrower?.email || '',
        `PHP ${Number(loan.principal || 0).toLocaleString()}`,
        loan.status,
        `${loan.term_months} mo`,
        formatLoanRateMonthly(loan),
      ]),
    )
    if (!ok) showToast('Please allow popups to export PDF.', 'error')
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Loans</h1>
        </div>
        {can('loans.approve') && (
          <Link to="/admin/loans/new" className={`${admin.btnPrimary} inline-flex items-center justify-center`}>
            New Application
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label className="sr-only" htmlFor="loan-search">
            Search loans
          </label>
          <input
            id="loan-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
            placeholder="Search by borrower name or email..."
            className={`w-full ${admin.input}`}
          />
        </div>
        <button type="button" onClick={() => load(1)} className={admin.btnSecondary}>
          Search
        </button>
        <button type="button" onClick={handleCsvExport} className={admin.btnSecondary}>
          Export CSV
        </button>
        <button type="button" onClick={handlePdfExport} className={admin.btnSecondary}>
          Export PDF
        </button>
      </div>

      <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
        {['', 'pending', 'ongoing', 'rejected', 'completed'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition duration-200 ${
              status === s ? admin.filterActive : admin.filterInactive
            }`}
          >
            {s || 'all'}
          </button>
        ))}
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${admin.cardNoHover} p-4`}>
              <div className="h-4 w-28 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-3 w-52 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-3 w-40 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className={`${admin.cardNoHover} p-4 text-sm ${admin.textMuted}`}>No loans found.</div>
        ) : (
          rows.map((loan) => (
            <div key={loan.id} className={`${admin.cardNoHover} space-y-2 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <Link
                  to={`/admin/loans/${loan.id}`}
                  className="font-semibold text-red-600 transition hover:underline dark:text-red-400"
                >
                  Loan #{loan.id}
                </Link>
                <span className="text-xs capitalize text-gray-600 dark:text-gray-300">{loan.status}</span>
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-100">{loan.borrower?.name || '—'}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Principal</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">₱{Number(loan.principal).toLocaleString()}</p>
                </div>
                <div>
                  <p className={`text-xs ${admin.textMuted}`}>Term / Rate</p>
              <p className="font-medium text-gray-900 dark:text-gray-100">{loan.term_months} mo · {formatLoanRateMonthly(loan)}</p>
                </div>
              </div>
              <Link
                to={`/admin/loans/${loan.id}`}
                className="inline-flex rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]"
              >
                Details
              </Link>
            </div>
          ))
        )}
      </div>

      <div className={`hidden lg:block ${admin.tableWrap}`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin800}`}>
          <thead>
            <tr className={admin.thead}>
              <th className={admin.tableCell}>ID</th>
              <th className={admin.tableCell}>Borrower</th>
              <th className={admin.tableCell}>Principal</th>
              <th className={admin.tableCell}>Status</th>
              <th className={admin.tableCell}>Term</th>
              <th className={admin.tableCell}>Rate</th>
              <th className={`${admin.tableCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={7} rows={6} />
            ) : rows.length === 0 ? (
              <EmptyTableRow colSpan={7} message="No loans found." />
            ) : (
              rows.map((loan) => (
                <tr key={loan.id} className={admin.tbodyRow}>
                  <td className={admin.tableCell}>
                    <Link
                      to={`/admin/loans/${loan.id}`}
                      className="font-medium text-red-600 transition hover:text-red-800 hover:underline dark:text-red-400 dark:hover:text-red-300"
                    >
                      #{loan.id}
                    </Link>
                  </td>
                  <td className={admin.tableCell}>{loan.borrower?.name || '—'}</td>
                  <td className={admin.tableCell}>₱{Number(loan.principal).toLocaleString()}</td>
                  <td className={`${admin.tableCell} capitalize`}>{loan.status}</td>
                  <td className={admin.tableCell}>{loan.term_months} mo</td>
                  <td className={`${admin.tableCell} tabular-nums ${admin.tableMuted}`}>{formatLoanRateMonthly(loan)}</td>
                  <td className={`${admin.tableCell} text-right`}>
                    <Link
                      to={`/admin/loans/${loan.id}`}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-100 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#1F2937]"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
