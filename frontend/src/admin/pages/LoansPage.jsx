import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { admin } from '../components/AdminUi.jsx'
import ApplicationsTable, { formatLoanRateMonthly } from '../components/applications/ApplicationsTable.jsx'
import ExportButtons from '../components/applications/ExportButtons.jsx'
import SearchBar from '../components/applications/SearchBar.jsx'
import StatusTabs from '../components/applications/StatusTabs.jsx'
import { applicationStatusLabel, normalizeApplicationStatus } from '../components/applications/applicationStatus.js'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { useToast } from '../context/ToastContext.jsx'
import { useApplications } from '../hooks/useApplications.js'
import { clearApplicationsCache, preApproveApplication, returnApplicationToPending } from '../services/applicationsService.js'
import { downloadCsv, openPrintPdf } from '../utils/export.js'

const PER_PAGE = 15

function toPage(value) {
  const page = Number(value || 1)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

export default function LoansPage() {
  const { can } = useAdminApiAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [refreshKey, setRefreshKey] = useState(0)

  const status = normalizeApplicationStatus(searchParams.get('status'))
  const search = searchParams.get('search') || ''
  const page = toPage(searchParams.get('page'))
  const { rows, meta, loading, error } = useApplications({ status, search, page, perPage: PER_PAGE, refreshKey })

  useEffect(() => {
    if (error) showToast(error.message, 'error')
  }, [error, showToast])

  const setQuery = (next) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      Object.entries(next).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '' || (key === 'status' && value === 'all') || (key === 'page' && String(value) === '1')) {
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
        loan.created_at || '',
      ]),
    [rows],
  )

  const exportSubtitle = `Filter: ${applicationStatusLabel(status)}${search.trim() ? `, Search: ${search.trim()}` : ''}`

  const handleCsvExport = () => {
    downloadCsv(
      `applications-${status || 'all'}.csv`,
      ['Loan ID', 'Borrower', 'Borrower Email', 'Principal', 'Status', 'Term (months)', 'Rate Monthly', 'Created At'],
      exportRows,
    )
    showToast('Applications CSV downloaded.', 'success')
  }

  const handlePdfExport = () => {
    const ok = openPrintPdf(
      'Applications Report',
      exportSubtitle,
      ['Loan ID', 'Borrower', 'Email', 'Principal', 'Status', 'Term', 'Rate'],
      rows.map((loan) => [
        loan.loan_number || `#${loan.id}`,
        loan.borrower?.name || '',
        loan.borrower?.email || '',
        `PHP ${Number(loan.principal || 0).toLocaleString()}`,
        applicationStatusLabel(loan.status),
        `${loan.term_months} mo`,
        formatLoanRateMonthly(loan),
      ]),
    )
    if (!ok) showToast('Please allow popups to export PDF.', 'error')
  }

  const handleStatusChange = (nextStatus) => {
    setQuery({ status: nextStatus, page: 1 })
  }

  const handleSearch = (nextSearch) => {
    setQuery({ search: nextSearch, page: 1 })
  }

  const handlePreApprove = async (loan) => {
    try {
      await preApproveApplication(loan.id)
      clearApplicationsCache()
      showToast(`${loan.loan_number || `Loan #${loan.id}`} pre-approved.`, 'success')
      setRefreshKey((key) => key + 1)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const handleReturnToPending = async (loan) => {
    try {
      await returnApplicationToPending(loan.id)
      clearApplicationsCache()
      showToast(`${loan.loan_number || `Loan #${loan.id}`} returned to pending.`, 'success')
      setRefreshKey((key) => key + 1)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const lastPage = Number(meta?.last_page || 1)
  const from = Number(meta?.from || 0)
  const to = Number(meta?.to || 0)
  const total = Number(meta?.total || rows.length)

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className={admin.pageTitle}>Applications</h1>
          <p className={admin.pageSubtitle}>Centralized loan application management with dynamic status filtering.</p>
        </div>
        {can('loans.approve') && (
          <Link to="/admin/loans/new" className={`${admin.btnPrimary} inline-flex items-center justify-center`}>
            New Application
          </Link>
        )}
      </div>

      <StatusTabs activeStatus={status} onChange={handleStatusChange} />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <SearchBar value={search} onSearch={handleSearch} />
        <ExportButtons onCsv={handleCsvExport} onPdf={handlePdfExport} disabled={loading || rows.length === 0} />
      </div>

      <ApplicationsTable
        rows={rows}
        loading={loading}
        canApprove={can('loans.approve')}
        onPreApprove={handlePreApprove}
        onReturnToPending={handleReturnToPending}
      />

      <div className="flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {total > 0 ? `Showing ${from}-${to} of ${total} applications` : 'No applications to display'}
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
