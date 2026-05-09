import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../admin/api/client.js'

const PRIORITY_DOT = {
  5: 'bg-rose-500',
  4: 'bg-amber-500',
  3: 'bg-sky-500',
  2: 'bg-slate-400',
  1: 'bg-slate-300',
}

/**
 * Laravel staff notification bell: polls `/notifications/poll`, lists `/notifications`,
 * marks read via `/notifications/{id}/read`. Requires JWT + `notifications.view`.
 */
export function AdminLaravelNotificationBell({ pollMs = 12000 }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const sinceRef = useRef(null)

  const refreshCount = useCallback(async () => {
    try {
      const data = await api('/notifications/unread-count')
      if (data?.ok && typeof data.count === 'number') setCount(data.count)
    } catch {
      /* ignore — bell stays quiet when API unavailable */
    }
  }, [])

  const poll = useCallback(async () => {
    try {
      const qs = sinceRef.current ? `?since=${encodeURIComponent(sinceRef.current)}` : ''
      const data = await api(`/notifications/poll${qs}`)
      if (!data?.ok) return
      if (data.latest_created_at) sinceRef.current = data.latest_created_at
      if (data.changed || typeof data.unread_count === 'number') {
        if (typeof data.unread_count === 'number') setCount(data.unread_count)
        if (open) {
          const list = await api('/notifications?per_page=15&unread_only=0')
          if (list?.ok && list.data?.data) setItems(list.data.data)
        }
      }
    } catch {
      /* ignore */
    }
  }, [open])

  const loadList = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const data = await api('/notifications?per_page=15&unread_only=0')
      if (data?.ok && data.data?.data) setItems(data.data.data)
      else setItems([])
    } catch (e) {
      setErr(e?.message || 'Could not load notifications')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshCount()
    const t = window.setInterval(() => {
      refreshCount()
      poll()
    }, pollMs)
    return () => window.clearInterval(t)
  }, [poll, pollMs, refreshCount])

  useEffect(() => {
    if (open) loadList()
  }, [open, loadList])

  const markRead = async (id) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST', body: '{}' })
      setItems((prev) =>
        prev.map((n) => (Number(n.id) === Number(id) ? { ...n, is_read: true } : n)),
      )
      setCount((c) => Math.max(0, c - 1))
    } catch {
      /* ignore */
    }
  }

  const markAll = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST', body: '{}' })
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
      setCount(0)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Laravel notifications"
        title="Platform alerts (loans, payments, CRM)"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[color:var(--admin-muted)] shadow-sm transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/25"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-[45]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-[50] mt-2 w-[min(calc(100vw-1.5rem),22rem)] origin-top-right rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl ring-1 ring-black/5">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-muted)]">
                Alerts
              </p>
              <button
                type="button"
                onClick={markAll}
                className="text-[11px] font-semibold text-[color:var(--admin-accent)] hover:underline"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
              {err ? (
                <p className="px-3 py-4 text-center text-xs text-rose-600">{err}</p>
              ) : loading ? (
                <p className="px-3 py-6 text-center text-xs text-[color:var(--admin-muted)]">Loading…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-[color:var(--admin-muted)]">No notifications</p>
              ) : (
                <ul className="divide-y divide-[var(--admin-border)]">
                  {items.map((n) => {
                    const pr = Number(n.priority ?? 2)
                    const dot = PRIORITY_DOT[pr] || PRIORITY_DOT[2]
                    const read = !!n.is_read
                    return (
                      <li key={n.id} className="px-3 py-2.5 text-left">
                        <div className="flex gap-2">
                          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} title={`Priority ${pr}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[var(--admin-text)]">{n.title}</p>
                            {n.body ? (
                              <p className="mt-0.5 line-clamp-3 text-[11px] text-[color:var(--admin-muted)]">{n.body}</p>
                            ) : null}
                            <p className="mt-1 text-[10px] text-[color:var(--admin-muted-2)]">
                              {n.category || n.type}
                              {n.created_at ? ` · ${new Date(n.created_at).toLocaleString()}` : ''}
                            </p>
                            {!read ? (
                              <button
                                type="button"
                                onClick={() => markRead(n.id)}
                                className="mt-1.5 text-[10px] font-semibold text-[color:var(--admin-accent)] hover:underline"
                              >
                                Mark read
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
