import { useCallback, useEffect, useState } from 'react'
import { borrowerApi } from '../api/client.js'

function fmtDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export default function BorrowerNotificationsPage({ embedded = false }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)

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

  const rows = data?.data ?? []

  const markAll = async () => {
    try {
      await borrowerApi('/borrower/notifications/read-all', { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('borrower-notifications-changed'))
    } catch (e) {
      setError(e.message || 'Failed to mark all read.')
    }
  }

  const markOne = async (id) => {
    try {
      await borrowerApi(`/borrower/notifications/${id}/read`, { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('borrower-notifications-changed'))
    } catch (e) {
      setError(e.message || 'Failed to update.')
    }
  }

  const markUnread = async (id) => {
    try {
      await borrowerApi(`/borrower/notifications/${id}/unread`, { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('borrower-notifications-changed'))
    } catch (e) {
      setError(e.message || 'Failed to update.')
    }
  }

  const clearAll = async () => {
    try {
      await borrowerApi('/borrower/notifications/clear-all', { method: 'POST', body: '{}' })
      load()
      window.dispatchEvent(new CustomEvent('borrower-notifications-changed'))
    } catch (e) {
      setError(e.message || 'Failed to clear notifications.')
    }
  }

  const categories = Array.from(new Set(rows.map((r) => String(r.category || '')).filter(Boolean)))

  return (
    <div className={`w-full min-w-0 ${embedded ? 'space-y-4' : 'space-y-6'}`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        {!embedded ? (
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Notifications</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Payment reminders and account updates. Mark items as read when you’ve seen them.
            </p>
          </div>
        ) : <span />}
        <button
          type="button"
          onClick={markAll}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/5"
        >
          Mark all read
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900/40 dark:bg-[#0F172A] dark:text-red-300 dark:hover:bg-red-900/20"
        >
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
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
          className={`rounded-xl border px-3 py-2 text-sm transition ${
            unreadOnly
              ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300'
              : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/5'
          }`}
        >
          {unreadOnly ? 'Showing unread' : 'Show unread only'}
        </button>
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
            className={`rounded-2xl border px-5 py-4 transition-colors ${
              n.read_at
                ? 'border-gray-200 bg-white text-gray-600 dark:border-[#1F2937] dark:bg-[#0c1220] dark:text-gray-400'
                : 'border-red-200 bg-red-50/90 text-gray-900 dark:border-red-900/40 dark:bg-red-950/20 dark:text-gray-100'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-500">
                  {n.type?.replace(/_/g, ' ') || 'Notice'}
                </p>
                <p className="mt-1 font-semibold">{n.title}</p>
                {n.body ? <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{n.body}</p> : null}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">{fmtDate(n.created_at)}</p>
              </div>
              {!n.read_at ? (
                <button
                  type="button"
                  onClick={() => markOne(n.id)}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/5"
                >
                  Mark read
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => markUnread(n.id)}
                  className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-white/5"
                >
                  Mark unread
                </button>
              )}
            </div>
          </li>
        ))}
        {rows.length === 0 && !error ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No notifications yet.</p>
        ) : null}
      </ul>
    </div>
  )
}
