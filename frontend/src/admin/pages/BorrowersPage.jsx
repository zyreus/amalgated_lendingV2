import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'
import { admin, TableSkeletonRows, EmptyTableRow } from '../components/AdminUi.jsx'
import CreateBorrowerModal from '../components/CreateBorrowerModal.jsx'
import { getLaravelStorageFileUrl } from '../../utils/lendingLaravelApi.js'

function riskBadge(level) {
  const l = (level || '').toLowerCase()
  if (l === 'low') {
    return 'bg-emerald-100 text-emerald-800 ring-emerald-500/25 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/35'
  }
  if (l === 'medium') {
    return 'bg-amber-100 text-amber-900 ring-amber-500/25 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/35'
  }
  if (l === 'high') {
    return 'bg-red-100 text-red-800 ring-red-500/25 dark:bg-red-600/15 dark:text-red-300 dark:ring-red-600/35'
  }
  return 'bg-gray-200 text-gray-600 ring-gray-300 dark:bg-[#1F2937] dark:text-gray-400 dark:ring-[#374151]'
}

function riskLabel(level) {
  const l = (level || '').toLowerCase()
  if (l === 'low') return 'Low'
  if (l === 'medium') return 'Medium'
  if (l === 'high') return 'High'
  return level || '—'
}

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'B'
  const first = parts[0]?.[0] || ''
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : ''
  return `${first}${second}`.toUpperCase()
}

function isImagePath(path) {
  return /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(String(path || ''))
}

function borrowerAvatarPath(borrower) {
  if (isImagePath(borrower?.profile_photo_path)) return borrower.profile_photo_path
  if (isImagePath(borrower?.id_document_path)) return borrower.id_document_path
  return ''
}

function fallbackAvatar(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Borrower')}&background=fee2e2&color=b91c1c&size=96&bold=true`
}

export default function BorrowersPage() {
  const { showToast } = useToast()
  const { can } = useAdminApiAuth()
  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [risk, setRisk] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const load = async (page = 1) => {
    setLoading(true)
    try {
      const q = new URLSearchParams({ page: String(page), per_page: '15' })
      if (search.trim()) q.set('search', search.trim())
      if (risk) q.set('risk_level', risk)
      const res = await api(`/borrowers?${q}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
  }, [risk])

  const rows = data?.data || []

  const handleDelete = async (b) => {
    if (!can('borrowers.delete') || deletingId) return
    const loanCount = Number(b.loans_count ?? 0)
    if (loanCount > 0) {
      showToast('Cannot delete a borrower who has loan records.', 'error')
      return
    }
    const ok = window.confirm(
      `Delete borrower account for "${b.name}" (${b.email})? This cannot be undone.`,
    )
    if (!ok) return
    setDeletingId(b.id)
    try {
      await api(`/borrowers/${b.id}`, { method: 'DELETE', body: '{}' })
      showToast('Borrower account deleted.', 'success')
      await load(data?.current_page || 1)
    } catch (e) {
      showToast(e.message || 'Delete failed.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className={admin.pageTitle}>Borrowers</h1>
          <p className={admin.pageSubtitle}></p>
        </div>

        <div className="sticky top-2 z-20 w-full sm:static sm:z-auto sm:w-auto">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={`${admin.btnPrimary} w-full px-6 sm:w-auto`}
          >
            Create New Borrower
          </button>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor="borrower-search">
            Search borrowers
          </label>
          <input
            id="borrower-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(1)}
            placeholder="Search borrowers by name, email, or phone..."
            className={`w-full ${admin.input}`}
          />
        </div>
        <button type="button" onClick={() => load(1)} className={`${admin.btnPrimary} w-full shrink-0 sm:w-auto`}>
          Search
        </button>
        <div className="flex max-w-full flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
          {['', 'low', 'medium', 'high'].map((r) => (
            <button
              key={r || 'all'}
              type="button"
              onClick={() => setRisk(r)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition duration-200 ${
                risk === r ? admin.filterActive : admin.filterInactive
              }`}
            >
              {r ? `${r} risk` : 'All risk'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`${admin.cardNoHover} p-4`}>
              <div className="h-4 w-36 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-3 w-44 animate-pulse rounded bg-gray-200 dark:bg-[#1F2937]" />
              <div className="mt-2 h-6 w-20 animate-pulse rounded-full bg-gray-200 dark:bg-[#1F2937]" />
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className={`${admin.cardNoHover} p-4 text-sm ${admin.textMuted}`}>No borrowers found.</div>
        ) : (
          rows.map((b) => (
            <div key={b.id} className={`${admin.cardNoHover} space-y-2 p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {borrowerAvatarPath(b) ? (
                    <img
                      src={getLaravelStorageFileUrl(borrowerAvatarPath(b))}
                      alt={b.name || 'Borrower'}
                      className="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-[#374151]"
                      onError={(e) => {
                        e.currentTarget.onerror = null
                        e.currentTarget.src = fallbackAvatar(b.name || 'Borrower')
                      }}
                    />
                  ) : (
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                      {initials(b.name || 'Borrower')}
                    </span>
                  )}
                  <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{b.name}</p>
                </div>
                <span className="text-sm tabular-nums text-gray-700 dark:text-gray-200">{b.loans_count ?? '—'} loan(s)</span>
              </div>
              <p className={`text-xs break-words ${admin.tableMuted}`}>{b.email}</p>
              <div className="flex items-center justify-between">
                <p className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                  Credit: {b.credit_score != null ? Number(b.credit_score).toFixed(0) : '—'}
                </p>
                {b.risk_level ? (
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${riskBadge(b.risk_level)}`}
                  >
                    {riskLabel(b.risk_level)}
                  </span>
                ) : (
                  <span className={`text-xs ${admin.textMuted}`}>—</span>
                )}
              </div>
              <p className={`text-xs ${admin.textMuted}`}>
                Identity checks: {Number(b.liveness_verifications_count ?? 0) + Number(b.face_verifications_count ?? 0)}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/admin/borrowers/${b.id}`}
                  className="inline-flex text-sm font-medium text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                >
                  View
                </Link>
                {can('borrowers.delete') ? (
                  <button
                    type="button"
                    disabled={deletingId === b.id || Number(b.loans_count ?? 0) > 0}
                    title={
                      Number(b.loans_count ?? 0) > 0
                        ? 'Remove loan records before deleting this borrower.'
                        : 'Delete borrower account'
                    }
                    onClick={() => handleDelete(b)}
                    className="text-sm font-medium text-red-700/90 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400/90"
                  >
                    {deletingId === b.id ? 'Deleting…' : 'Delete'}
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={`hidden lg:block ${admin.tableWrap}`}>
        <table className={`${admin.tableBase} ${admin.tableText} ${admin.tableMin720}`}>
          <thead>
            <tr className={admin.thead}>
              <th className={admin.tableCell}>Name</th>
              <th className={admin.tableCell}>Email</th>
              <th className={admin.tableCell}>Credit</th>
              <th className={admin.tableCell}>Risk</th>
              <th className={admin.tableCell}>Loans</th>
              <th className={admin.tableCell}>Identity</th>
              <th className={admin.tableCell}> </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeletonRows cols={7} rows={6} />
            ) : rows.length === 0 ? (
              <EmptyTableRow colSpan={7} message="No borrowers found." />
            ) : (
              rows.map((b) => (
                <tr key={b.id} className={admin.tbodyRow}>
                  <td className={admin.tableCell}>
                    <div className="flex items-center gap-2">
                      {borrowerAvatarPath(b) ? (
                        <img
                          src={getLaravelStorageFileUrl(borrowerAvatarPath(b))}
                          alt={b.name || 'Borrower'}
                          className="h-8 w-8 rounded-full border border-gray-200 object-cover dark:border-[#374151]"
                          onError={(e) => {
                            e.currentTarget.onerror = null
                            e.currentTarget.src = fallbackAvatar(b.name || 'Borrower')
                          }}
                        />
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-200">
                          {initials(b.name || 'Borrower')}
                        </span>
                      )}
                      <span className="font-medium">{b.name}</span>
                    </div>
                  </td>
                  <td className={`${admin.tableCell} ${admin.tableMuted}`}>{b.email}</td>
                  <td className={`${admin.tableCell} tabular-nums`}>
                    {b.credit_score != null ? Number(b.credit_score).toFixed(0) : '—'}
                  </td>
                  <td className={admin.tableCell}>
                    {b.risk_level ? (
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${riskBadge(b.risk_level)}`}
                      >
                        {riskLabel(b.risk_level)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${admin.tableCell} tabular-nums`}>{b.loans_count ?? '—'}</td>
                  <td className={`${admin.tableCell} tabular-nums`}>
                    {Number(b.liveness_verifications_count ?? 0) + Number(b.face_verifications_count ?? 0)}
                  </td>
                  <td className={`${admin.tableCell} text-right`}>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        to={`/admin/borrowers/${b.id}`}
                        className="text-sm font-medium text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
                      >
                        View
                      </Link>
                      {can('borrowers.delete') ? (
                        <button
                          type="button"
                          disabled={deletingId === b.id || Number(b.loans_count ?? 0) > 0}
                          title={
                            Number(b.loans_count ?? 0) > 0
                              ? 'Remove loan records before deleting this borrower.'
                              : 'Delete borrower account'
                          }
                          onClick={() => handleDelete(b)}
                          className="text-sm font-medium text-red-700/90 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400/90"
                        >
                          {deletingId === b.id ? 'Deleting…' : 'Delete'}
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

      <CreateBorrowerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={async () => load(1)}
      />
    </div>
  )
}
