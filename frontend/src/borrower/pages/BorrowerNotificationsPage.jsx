import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { borrowerApi } from '../api/client.js'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { formatCrmInboxDate, getResolvedDisplayTimeZone } from '../../utils/timestamps.js'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'

function categoryLabel(n) {
  const raw = (n.category || n.type || 'notice').toString()
  return raw.replace(/_/g, ' ').toUpperCase()
}

function TrashIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  )
}

export default function BorrowerNotificationsPage({ embedded = false }) {
  const { user } = useBorrowerAuth()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const selectAllRef = useRef(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('per_page', '50')
      if (category) qs.set('category', category)
      if (unreadOnly) qs.set('unread_only', '1')
      const res = await borrowerApi(`/borrower/notifications?${qs.toString()}`)
      setData(res.data)
    } catch (e) {
      setError(e.message || 'Failed to load notifications.')
    }
  }, [category, unreadOnly])

  useEffect(() => {
    load()
  }, [load])

  const rows = useMemo(() => data?.data ?? [], [data])
  const rowIds = useMemo(() => rows.map((r) => r.id), [rows])
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  useEffect(() => {
    const valid = new Set(rowIds)
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)))
  }, [rowIds])

  const allVisibleSelected = rowIds.length > 0 && rowIds.every((id) => selectedSet.has(id))

  useEffect(() => {
    const el = selectAllRef.current
    if (!el) return
    el.indeterminate = selectedIds.length > 0 && !allVisibleSelected
  }, [selectedIds.length, allVisibleSelected])

  const displayTz = useMemo(() => getResolvedDisplayTimeZone(user), [user])
  const fmtDate = useCallback((iso) => formatCrmInboxDate(iso, { timeZone: displayTz }), [displayTz])

  const notifyChanged = () => {
    window.dispatchEvent(new CustomEvent('borrower-notifications-changed'))
  }

  const markAll = async () => {
    try {
      setBusy(true)
      await borrowerApi('/borrower/notifications/read-all', { method: 'POST', body: '{}' })
      await load()
      notifyChanged()
    } catch (e) {
      setError(e.message || 'Failed to mark all read.')
    } finally {
      setBusy(false)
    }
  }

  const markOne = async (id) => {
    try {
      await borrowerApi(`/borrower/notifications/${id}/read`, { method: 'POST', body: '{}' })
      await load()
      notifyChanged()
    } catch (e) {
      setError(e.message || 'Failed to update.')
    }
  }

  const markUnread = async (id) => {
    try {
      await borrowerApi(`/borrower/notifications/${id}/unread`, { method: 'POST', body: '{}' })
      await load()
      notifyChanged()
    } catch (e) {
      setError(e.message || 'Failed to update.')
    }
  }

  const runClearAll = async () => {
    try {
      setBusy(true)
      await borrowerApi('/borrower/notifications/clear-all', { method: 'POST', body: '{}' })
      setSelectedIds([])
      await load()
      notifyChanged()
    } catch (e) {
      setError(e.message || 'Failed to clear notifications.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const runDelete = async (ids) => {
    if (!ids.length) return
    try {
      setBusy(true)
      if (ids.length === 1) {
        await borrowerApi(`/borrower/notifications/${ids[0]}`, { method: 'DELETE' })
      } else {
        await borrowerApi('/borrower/notifications/bulk-delete', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        })
      }
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
      await load()
      notifyChanged()
    } catch (e) {
      setError(e.message || 'Failed to delete notifications.')
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const categories = Array.from(new Set(rows.map((r) => String(r.category || '')).filter(Boolean)))

  const toolbarBtn =
    'inline-flex min-h-[40px] items-center justify-center rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/10'

  const onSelectAllChange = () => {
    if (allVisibleSelected) setSelectedIds([])
    else setSelectedIds([...rowIds])
  }

  const toggleRow = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className={`w-full min-w-0 ${embedded ? 'space-y-3' : 'space-y-6'}`}>
      {!embedded ? (
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notifications</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Payment reminders and account updates. Select items to delete in bulk, or clear everything from view.
          </p>
        </div>
      ) : null}

      <div
        className={
          embedded
            ? 'rounded-2xl border border-gray-200/90 bg-[#fcfdf8] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:border-[#1F2937] dark:bg-[#0c1220]/80 dark:shadow-none'
            : 'rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A] dark:shadow-lg'
        }
      >
        <div className={`flex flex-col gap-3 ${embedded ? '' : 'sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'}`}>
          <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onSelectAllChange}
              disabled={!rowIds.length || busy}
              className="h-4 w-4 rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332] dark:border-gray-600 dark:bg-[#0F172A]"
            />
            Select all
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={markAll} disabled={busy} className={toolbarBtn}>
              Mark all read
            </button>
            <button
              type="button"
              disabled={busy || selectedIds.length === 0}
              onClick={() => setConfirm({ kind: 'delete', ids: [...selectedIds] })}
              className={`${toolbarBtn} border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30`}
            >
              Delete selected{selectedIds.length ? ` (${selectedIds.length})` : ''}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirm({ kind: 'clearAll' })}
              className={`${toolbarBtn} border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30`}
            >
              Clear all
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200/80 pt-3 dark:border-[#1F2937]">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {String(c).replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`min-h-[40px] rounded-xl border px-3 py-2 text-sm font-medium transition ${
              unreadOnly
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300'
                : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/5'
            }`}
          >
            {unreadOnly ? 'Showing unread' : 'Show unread only'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {rows.map((n) => (
          <li
            key={n.id}
            className={`rounded-2xl border px-4 py-3 transition-colors sm:px-5 sm:py-4 ${
              n.read_at
                ? 'border-gray-200 bg-white text-gray-600 dark:border-[#1F2937] dark:bg-[#0c1220] dark:text-gray-400'
                : 'border-red-200 bg-red-50/90 text-gray-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-gray-100'
            }`}
          >
            <div className="flex gap-3">
              <div className="flex shrink-0 items-start pt-1">
                <input
                  type="checkbox"
                  checked={selectedSet.has(n.id)}
                  onChange={() => toggleRow(n.id)}
                  disabled={busy}
                  aria-label={`Select notification ${n.title || n.id}`}
                  className="h-4 w-4 rounded border-gray-300 text-[#1B4332] focus:ring-[#1B4332] dark:border-gray-600 dark:bg-[#0F172A]"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                      {categoryLabel(n)}
                    </p>
                    <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{n.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    {!n.read_at ? (
                      <button
                        type="button"
                        onClick={() => markOne(n.id)}
                        disabled={busy}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/10"
                      >
                        Mark read
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markUnread(n.id)}
                        disabled={busy}
                        className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/10"
                      >
                        Mark unread
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirm({ kind: 'delete', ids: [n.id] })}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                      aria-label="Delete notification"
                      title="Delete"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {n.body ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.body}</p> : null}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{fmtDate(n.created_at)}</p>
              </div>
            </div>
          </li>
        ))}
        {rows.length === 0 && !error ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
        ) : null}
      </ul>

      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Delete notification"
        message={
          confirm?.kind === 'delete' && confirm.ids?.length > 1
            ? `Permanently delete ${confirm.ids.length} notifications? This cannot be undone.`
            : 'Permanently delete this notification? This cannot be undone.'
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={() => confirm?.kind === 'delete' && runDelete(confirm.ids)}
      />

      <ConfirmDialog
        open={confirm?.kind === 'clearAll'}
        title="Clear all notifications"
        message="This hides every notification from your inbox (you can still receive new ones). Continue?"
        confirmLabel="Clear all"
        cancelLabel="Cancel"
        busy={busy}
        onCancel={() => !busy && setConfirm(null)}
        onConfirm={runClearAll}
      />
    </div>
  )
}
