import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import { admin } from '../components/AdminUi.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { getAdminNotificationHref } from '../utils/notificationRoutes.js'

const CATEGORY_LABELS = {
  loan_application_submitted: 'New application',
  loan_application_approved: 'Loan approved',
  loan_application_rejected: 'Loan rejected',
  borrower_payment_submitted: 'Payment submitted',
  payment_overdue: 'Overdue',
  feedback_submitted: 'Feedback',
  crm_customer_inquiry: 'CRM message',
  document_verification: 'Document review',
  account_verification: 'Account',
  security_alert: 'Security',
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export default function NotificationsPage({ embedded = false, onNavigate = null }) {
  const { showToast } = useToast()
  const [data, setData] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState(null)

  const load = async () => {
    try {
      const qs = new URLSearchParams()
      qs.set('per_page', '40')
      if (category) qs.set('category', category)
      if (unreadOnly) qs.set('unread_only', '1')
      const res = await api(`/notifications?${qs.toString()}`)
      setData(res.data)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  useEffect(() => {
    load()
  }, [showToast, category, unreadOnly])

  const rows = data?.data || []
  const selectedCount = selectedIds.length

  useEffect(() => {
    const rowIds = new Set(rows.map((r) => Number(r.id)))
    setSelectedIds((prev) => prev.filter((id) => rowIds.has(Number(id))))
  }, [rows])

  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const markOne = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const markUnread = async (id) => {
    try {
      await api(`/notifications/${id}/unread`, { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  const selectAll = () => {
    setSelectedIds(rows.map((r) => Number(r.id)))
  }

  const unselectAll = () => {
    setSelectedIds([])
  }

  const toggleSelected = (id) => {
    const nId = Number(id)
    setSelectedIds((prev) => (prev.includes(nId) ? prev.filter((x) => x !== nId) : [...prev, nId]))
  }

  const runDeleteSelected = async () => {
    if (!selectedIds.length) return
    try {
      await api('/notifications/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      })
      setSelectedIds([])
      await load()
      window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
    } catch (e) {
      showToast(e.message, 'error')
      throw e
    }
  }

  const runClearAllOnScreen = async () => {
    if (!rows.length) return
    const ids = rows.map((r) => Number(r.id)).filter((v) => Number.isFinite(v))
    if (!ids.length) return
    try {
      await api('/notifications/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      })
      setSelectedIds([])
      await load()
      window.dispatchEvent(new CustomEvent('admin-notifications-changed'))
    } catch (e) {
      showToast(e.message, 'error')
      throw e
    }
  }

  const categories = Array.from(new Set(rows.map((r) => String(r.category || '')).filter(Boolean)))

  return (
    <div className={`w-full min-w-0 ${embedded ? 'space-y-4' : 'space-y-6'}`}>
      <ConfirmModal
        open={confirmDialog != null}
        onClose={() => setConfirmDialog(null)}
        title={
          confirmDialog?.type === 'clearAll'
            ? 'Clear all notifications?'
            : 'Delete selected notifications?'
        }
        description={
          confirmDialog?.type === 'clearAll'
            ? `This will remove all ${rows.length} notification(s) in the current list (including any filters you applied). This cannot be undone.`
            : `This will permanently delete ${selectedCount} selected notification(s). This cannot be undone.`
        }
        confirmLabel={confirmDialog?.type === 'clearAll' ? 'Clear all' : 'Delete'}
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={async () => {
          if (confirmDialog?.type === 'clearAll') await runClearAllOnScreen()
          else if (confirmDialog?.type === 'deleteSelected') await runDeleteSelected()
        }}
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        {!embedded ? (
          <div>
            <h1 className={admin.pageTitle}>Notifications</h1>
            <p className={admin.pageSubtitle}>New loan applications and system events.</p>
          </div>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-white/15 dark:bg-transparent dark:text-gray-100"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c] || c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded-xl border px-3 py-2 text-sm transition ${
              unreadOnly
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-300'
                : 'border-gray-200 text-gray-800 hover:bg-gray-100 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5'
            }`}
          >
            {unreadOnly ? 'Showing unread' : 'Show unread only'}
          </button>
          <button
            type="button"
            onClick={selectAll}
            disabled={rows.length === 0}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={unselectAll}
            disabled={selectedCount === 0}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 transition hover:bg-gray-100 disabled:opacity-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5"
          >
            Unselect all
          </button>
          <button
            type="button"
            onClick={() => selectedCount > 0 && setConfirmDialog({ type: 'deleteSelected' })}
            disabled={selectedCount === 0}
            className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-900/30"
          >
            Delete selected{selectedCount ? ` (${selectedCount})` : ''}
          </button>
          <button
            type="button"
            onClick={markAll}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-800 transition hover:bg-gray-100 dark:border-white/15 dark:text-gray-100 dark:hover:bg-white/5"
          >
            Mark all read
          </button>
          <button
            type="button"
            onClick={() => rows.length > 0 && setConfirmDialog({ type: 'clearAll' })}
            disabled={rows.length === 0}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-300"
          >
            Clear all
          </button>
        </div>
      </div>

      <ul className="space-y-3">
        {rows.map((n) => {
          const href = getAdminNotificationHref(n)
          const cardTone = n.read_at
            ? 'border-gray-200 bg-gray-50 text-gray-600 dark:border-white/5 dark:bg-black/30 dark:text-gray-400'
            : 'border-red-300 bg-red-50 text-gray-900 dark:border-red-500/30 dark:bg-red-950/20 dark:text-gray-100'
          const body = (
            <>
              <p className="font-semibold">{n.title}</p>
              {n.body ? <p className={`mt-1 text-sm ${admin.textMuted}`}>{n.body}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-black/20 dark:text-red-300">
                  {CATEGORY_LABELS[n.category] || String(n.category || n.type || 'notice').replace(/_/g, ' ')}
                </span>
                <p className={`text-xs ${admin.textMuted}`}>{formatTime(n.created_at)}</p>
              </div>
            </>
          )
          return (
            <li key={n.id} className={`rounded-2xl border px-5 py-4 transition-colors duration-300 ${cardTone}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="mt-0.5 inline-flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(Number(n.id))}
                    onChange={() => toggleSelected(n.id)}
                    className="h-4 w-4 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
                    aria-label={`Select notification ${n.title || n.id}`}
                  />
                </label>
                {href ? (
                  <Link
                    to={href}
                    onClick={() => {
                      if (typeof onNavigate === 'function') onNavigate()
                      if (!n.read_at) void markOne(n.id)
                    }}
                    className={`min-w-0 flex-1 rounded-lg outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-red-500 ${
                      n.read_at ? '' : 'hover:underline'
                    }`}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read_at) void markOne(n.id)
                    }}
                    className={`min-w-0 flex-1 rounded-lg text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-red-500 ${
                      n.read_at ? 'cursor-default' : 'cursor-pointer hover:underline'
                    }`}
                  >
                    {body}
                  </button>
                )}
                {!n.read_at ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      markOne(n.id)
                    }}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/5"
                  >
                    Mark read
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      markUnread(n.id)
                    }}
                    className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-white/15 dark:bg-transparent dark:text-gray-100 dark:hover:bg-white/5"
                  >
                    Mark unread
                  </button>
                )}
              </div>
            </li>
          )
        })}
        {rows.length === 0 && <p className={`text-sm ${admin.textMuted}`}>No notifications.</p>}
      </ul>
    </div>
  )
}
