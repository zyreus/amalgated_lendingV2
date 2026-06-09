import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { admin } from '../components/AdminUi.jsx'
import ApplicationsTable, { formatLoanRateMonthly } from '../components/applications/ApplicationsTable.jsx'
import ExportButtons from '../components/applications/ExportButtons.jsx'
import SearchBar from '../components/applications/SearchBar.jsx'
import { applicationStatusLabel } from '../components/applications/applicationStatus.js'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { useToast } from '../context/ToastContext.jsx'
import { useApplications } from '../hooks/useApplications.js'
import { downloadCsv, openPrintPdf } from '../utils/export.js'

const PER_PAGE = 15
const ARCHIVED_STATUS = 'rejected'

function toPage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

export default function ArchivedApplicationsPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const page = toPage(searchParams.get('page'))
  const { rows, meta, loading, error } = useApplications({
    status: ARCHIVED_STATUS,
    search,
    page,
    perPage: PER_PAGE,
  })

  useEffect(() => {
    if (error) showToast(error.message, 'error')
  }, [error, showToast])

  const setQuery = (next) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      Object.entries(next).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || (key === 'page' && String(value) === '1')) {
          params.delete(key)
        } else {
          params.set(key, String(value))
        }
      })
      return params
    })
  }

  const exportRows = useMemo(
    () =>
      rows.map((loan) => [
        loan.loan_number || loan.id,
        loan.borrower?.name || '',
        loan.borrower?.email || '',
        loan.principal,
        applicationStatusLabel(loan.status),
        loan.term_months,
        formatLoanRateMonthly(loan),
        loan.rejected_at || loan.updated_at || '',
        loan.rejection_reason || '',
      ]),
    [rows],
  )

  const handleCsvExport = () => {
    downloadCsv(
      'archived-applications.csv',
      ['Loan ID', 'Borrower', 'Borrower Email', 'Principal', 'Status', 'Term (months)', 'Rate Monthly', 'Archived At', 'Reason'],
      exportRows,
    )
    showToast('Archived applications CSV downloaded.', 'success')
  }

  const handlePdfExport = () => {
    const ok = openPrintPdf(
      'Archived Applications Report',
      search.trim() ? `Search: ${search.trim()}` : 'Rejected applications',
      ['Loan ID', 'Borrower', 'Email', 'Principal', 'Status', 'Reason'],
      rows.map((loan) => [
        loan.loan_number || `#${loan.id}`,
        loan.borrower?.name || '',
        loan.borrower?.email || '',
        `PHP ${Number(loan.principal || 0).toLocaleString()}`,
        applicationStatusLabel(loan.status),
        loan.rejection_reason || '',
      ]),
    )
    if (!ok) showToast('Please allow popups to export PDF.', 'error')
  }

  const handleSearch = (nextSearch) => {
    setQuery({ search: nextSearch, page: 1 })
  }

  const lastPage = Number(meta?.last_page || 1)
  const from = Number(meta?.from || 0)
  const to = Number(meta?.to || 0)
  const total = Number(meta?.total || rows.length)

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Archived Applications</h1>
          <p className={admin.pageSubtitle}>Review rejected applications that have been moved out of the active application workflow.</p>
        </div>
        <Link to="/admin/applications" className={`${admin.btnSecondary} inline-flex items-center justify-center`}>
          Back to Applications
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SearchBar value={search} onSearch={handleSearch} />
        <ExportButtons onCsv={handleCsvExport} onPdf={handlePdfExport} disabled={loading || rows.length === 0} />
      </div>

      <ApplicationsTable rows={rows} loading={loading} canApprove={can('loans.approve')} />

      <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {total > 0 ? `Showing ${from}-${to} of ${total} archived applications` : 'No archived applications to display'}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setQuery({ page: page - 1 })} className={admin.paginationBtn}>
            Previous
          </button>
          <button type="button" disabled={page >= lastPage || loading} onClick={() => setQuery({ page: page + 1 })} className={admin.paginationBtn}>
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
