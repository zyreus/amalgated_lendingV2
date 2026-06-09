import { useEffect, useState } from 'react'
import { Eye, RotateCcw, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { admin, EmptyTableRow, TableSkeletonRows } from '../components/AdminUi.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { useToast } from '../context/ToastContext.jsx'

function riskBadge(level) {
  const l = (level || '').toLowerCase()
  if (l === 'low') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
  if (l === 'medium') return 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200'
  if (l === 'high') return 'bg-red-100 text-red-800 dark:bg-red-600/15 dark:text-red-300'
  return 'bg-gray-200 text-gray-600 dark:bg-[#1F2937] dark:text-gray-400'
}

function reasonBadge(reason) {
  if (reason === 'Application Rejected') {
    return 'bg-red-100 text-red-800 dark:bg-red-600/15 dark:text-red-300'
  }
  if (reason === 'Deleted Pending') {
    return 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-600/10 dark:text-red-300 dark:ring-red-500/30'
  }
  return 'bg-gray-200 text-gray-700 dark:bg-[#1F2937] dark:text-gray-300'
}

function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

const ONGOING_LOAN_DELETE_MESSAGE = 'This borrower cannot be deleted because they still have an ongoing loan.'

function hasOngoingLoan(borrower) {
  return Boolean(borrower?.has_ongoing_loan)
}

export default function ArchivedBorrowersPage() {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [permanentTarget, setPermanentTarget] = useState(null)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '15' })
      if (search.trim()) q.set('search', search.trim())
      if (reason) q.set('archive_reason', reason)
      const res = await api(`/borrowers/archived?${q}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message || 'Could not load archived borrowers.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [reason])

  const restoreBorrower = async (borrower) => {
    if (!can('borrowers.restore') || actionLoadingId) return
    setActionLoadingId(borrower.id)
    try {
      await api(`/borrowers/${borrower.id}/restore`, { method: 'POST', body: '{}' })
      showToast('Borrower restored successfully.', 'success')
      await load(data?.current_page || 1)
    } catch (e) {
      showToast(e.message || 'Restore failed.', 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  const deletePermanently = async (borrower) => {
    if (!can('borrowers.delete') || actionLoadingId) return
    if (hasOngoingLoan(borrower)) {
      showToast(ONGOING_LOAN_DELETE_MESSAGE, 'error')
      return
    }
    setActionLoadingId(borrower.id)
    try {
      await api(`/borrowers/${borrower.id}/permanent`, { method: 'DELETE', body: '{}' })
      showToast('Borrower permanently deleted.', 'success')
      await load(data?.current_page || 1)
    } catch (e) {
      showToast(e.message || 'Permanent delete failed.', 'error')
    } finally {
      setActionLoadingId(null)
    }
  }

  const rows = data?.data || []
  const filters = [
    ['', 'All archived'],
    ['rejected', 'Rejected'],
    ['manual', 'Manually Archived'],
    ['deleted_pending', 'Deleted Pending'],
  ]

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={admin.pageTitle}>Archived Borrowers</h1>
          <p className={admin.pageSubtitle}>Search, restore, or permanently remove archived borrower records.</p>
        </div>
        <Link to="/admin/borrowers" className={`${admin.btnSecondary} text-center`}>
          Back to Borrowers
        </Link>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="archived-borrower-search">
            Search archived borrowers
          </label>
          <input
            id="archived-borrower-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
            placeholder="Search archived borrowers by name, email, or phone..."
            className={`w-full ${admin.input}`}
          />
        </div>
        <button type="button" onClick={() => load(1)} className={`${admin.btnPrimary} w-full shrink-0 sm:w-auto`}>
          Search
        </button>
        <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {filters.map(([value, label]) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setReason(value)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition duration-200 ${
                reason === value ? admin.filterActive : admin.filterInactive
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${admin.cardNoHover} animate-pulse p-4`}>
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-3 h-3 w-56 rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-4 h-7 w-28 rounded-full bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className={`${admin.cardNoHover} p-8 text-center`}>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">No archived borrowers found.</p>
            <p className={`mt-1 text-sm ${admin.textMuted}`}>Archived and deleted-pending borrowers will appear here.</p>
          </div>
        ) : (
          rows.map((b) => (
            <div key={b.id} className={`${admin.cardNoHover} space-y-3 p-4`}>
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">{b.name}</p>
                <p className={`text-xs break-words ${admin.tableMuted}`}>{b.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Credit: {b.credit_score != null ? Number(b.credit_score).toFixed(0) : '—'}</span>
                <span>Loans: {b.loans_count ?? '—'}</span>
                <span className={`rounded-full px-2 py-0.5 text-center text-xs font-semibold ${riskBadge(b.risk_level)}`}>
                  {b.risk_level || 'No risk'}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-center text-xs font-semibold ${reasonBadge(b.archive_reason)}`}>
                  {b.archive_reason || 'Archived'}
                </span>
                {hasOngoingLoan(b) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-center text-xs font-semibold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/30">
                    Ongoing Loan
                  </span>
                ) : null}
              </div>
              <p className={`text-xs ${admin.textMuted}`}>Archived: {formatDate(b.archived_at)}</p>
              <div className="flex flex-wrap gap-3">
                <Link to={`/admin/borrowers/${b.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline dark:text-red-400">
                  <Eye className="h-4 w-4" />
                  View
                </Link>
                {can('borrowers.restore') ? (
                  <button type="button" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-300" disabled={actionLoadingId === b.id} onClick={() => setRestoreTarget(b)}>
                    <RotateCcw className="h-4 w-4" />
                    Restore
                  </button>
                ) : null}
                {can('borrowers.delete') ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                    disabled={actionLoadingId === b.id || hasOngoingLoan(b)}
                    onClick={() => setDeleteTarget(b)}
                    title={hasOngoingLoan(b) ? ONGOING_LOAN_DELETE_MESSAGE : undefined}
                  >
                    <Trash2 className="h-4 w-4" />
                    {hasOngoingLoan(b) ? 'Cannot Delete' : 'Delete Permanently'}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`hidden lg:block ${admin.tableWrap}`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin900}`}>
          <thead>
            <tr className={admin.thead}>
              <th className={admin.tableCell}>Name</th>
              <th className={admin.tableCell}>Email</th>
              <th className={admin.tableCell}>Credit Score</th>
              <th className={admin.tableCell}>Risk Level</th>
              <th className={admin.tableCell}>Loan Count</th>
              <th className={admin.tableCell}>Archived Date</th>
              <th className={admin.tableCell}>Archive Reason</th>
              <th className={`${admin.tableCell} text-right`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={8} rows={6} />
            ) : rows.length === 0 ? (
              <EmptyTableRow colSpan={8} message="No archived borrowers found." />
            ) : (
              rows.map((b) => (
                <tr key={b.id} className={admin.tbodyRow}>
                  <td className={`${admin.tableCell} font-medium`}>{b.name}</td>
                  <td className={`${admin.tableCell} ${admin.tableMuted}`}>{b.email}</td>
                  <td className={`${admin.tableCell} tabular-nums`}>{b.credit_score != null ? Number(b.credit_score).toFixed(0) : '—'}</td>
                  <td className={admin.tableCell}>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${riskBadge(b.risk_level)}`}>
                      {b.risk_level || '—'}
                    </span>
                  </td>
                  <td className={`${admin.tableCell} tabular-nums`}>
                    <div className="flex flex-col gap-1">
                      <span>{b.loans_count ?? '—'}</span>
                      {hasOngoingLoan(b) ? (
                        <span className="inline-flex w-fit rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900 ring-1 ring-amber-300 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/30">
                          Ongoing Loan
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${admin.tableCell} ${admin.tableMuted}`}>{formatDate(b.archived_at)}</td>
                  <td className={admin.tableCell}>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${reasonBadge(b.archive_reason)}`}>
                      {b.archive_reason || 'Archived'}
                    </span>
                  </td>
                  <td className={`${admin.tableCell} text-right`}>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link to={`/admin/borrowers/${b.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline dark:text-red-400">
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      {can('borrowers.restore') ? (
                        <button type="button" disabled={actionLoadingId === b.id} onClick={() => setRestoreTarget(b)} className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:underline disabled:opacity-50 dark:text-emerald-300">
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </button>
                      ) : null}
                      {can('borrowers.delete') ? (
                        <button
                          type="button"
                          disabled={actionLoadingId === b.id || hasOngoingLoan(b)}
                          onClick={() => setDeleteTarget(b)}
                          title={hasOngoingLoan(b) ? ONGOING_LOAN_DELETE_MESSAGE : undefined}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {hasOngoingLoan(b) ? 'Cannot Delete' : 'Delete Permanently'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data ? (
        <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Showing {data.from ?? 0}-{data.to ?? 0} of {data.total ?? 0} archived borrowers
          </span>
          <div className="flex items-center gap-2">
            <button type="button" className={admin.paginationBtn} disabled={loading || !data.prev_page_url} onClick={() => load(Math.max(1, Number(data.current_page || 1) - 1))}>
              Previous
            </button>
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Page {data.current_page ?? 1} of {data.last_page ?? 1}
            </span>
            <button type="button" className={admin.paginationBtn} disabled={loading || !data.next_page_url} onClick={() => load(Number(data.current_page || 1) + 1)}>
              Next
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title="Restore borrower?"
        description="Restoring moves this borrower back to the active borrowers table and removes their archive status."
        confirmLabel="Restore Borrower"
        tone="default"
        onConfirm={() => restoreBorrower(restoreTarget)}
      />
      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Permanently delete borrower?"
        description="This is step 1 of 2. The borrower and related borrower records will be permanently removed after the final confirmation."
        confirmLabel="Continue"
        tone="danger"
        onConfirm={() => setPermanentTarget(deleteTarget)}
      />
      <ConfirmModal
        open={Boolean(permanentTarget)}
        onClose={() => setPermanentTarget(null)}
        title="Final confirmation required"
        description="This action cannot be undone. Permanently delete this archived borrower from the database?"
        confirmLabel="Delete Permanently"
        tone="danger"
        onConfirm={() => deletePermanently(permanentTarget)}
      />
    </div>
  )
}
