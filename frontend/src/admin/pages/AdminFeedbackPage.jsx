import { useCallback, useEffect, useMemo, useState } from 'react'
import { io } from 'socket.io-client'
import { api } from '../api/client.js'
import { adminSocketUrls } from '../../utils/adminChatApi.js'

const STATUS_OPTIONS = ['all', 'new', 'read', 'replied']

export default function AdminFeedbackPage() {
  const [status, setStatus] = useState('all')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = status === 'all' ? '' : `?status=${encodeURIComponent(status)}`
      const res = await api(`/feedbacks${query}`)
      const rows = Array.isArray(res?.data) ? res.data : []
      setItems(rows)
      if (rows.length === 0) {
        setSelected(null)
      } else if (!selected || !rows.some((r) => r.id === selected.id)) {
        setSelected(rows[0])
      }
    } catch (err) {
      setError(err?.message || 'Unable to load feedback.')
    } finally {
      setLoading(false)
    }
  }, [status, selected])

  useEffect(() => {
    loadFeedback()
  }, [loadFeedback])

  useEffect(() => {
    let disposed = false
    let socket = null
    const targets = adminSocketUrls()

    const connect = (index) => {
      if (disposed || index >= targets.length) return
      socket = io(targets[index], { transports: ['websocket', 'polling'] })
      socket.on('connect', () => {
        socket.emit('admin:join')
      })
      socket.on('feedback:refresh', () => loadFeedback())
      socket.on('connect_error', () => {
        socket.removeAllListeners()
        socket.disconnect()
        connect(index + 1)
      })
    }

    connect(0)
    return () => {
      disposed = true
      socket?.removeAllListeners()
      socket?.disconnect()
    }
  }, [loadFeedback])

  const markStatus = useCallback(
    async (nextStatus) => {
      if (!selected) return
      try {
        await api(`/feedbacks/${selected.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        })
        await loadFeedback()
      } catch (err) {
        setError(err?.message || 'Unable to update feedback status.')
      }
    },
    [selected, loadFeedback],
  )

  const unreadCount = useMemo(() => items.filter((x) => x.status === 'new').length, [items])

  return (
    <div className="grid min-h-[70vh] gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Feedback Inbox</h2>
          <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
            {unreadCount} new
          </span>
        </div>

        <div className="mt-3 flex gap-2">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setStatus(option)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                status === option
                  ? 'bg-red-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {option === 'all' ? 'All' : option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto pr-1">
          {loading ? <p className="text-sm text-gray-500">Loading feedback...</p> : null}
          {!loading && items.length === 0 ? <p className="text-sm text-gray-500">No feedback yet.</p> : null}
          {!loading &&
            items.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selected?.id === row.id
                    ? 'border-red-300 bg-red-50/40'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{row.subject || 'General Feedback'}</p>
                  <span className="text-xs text-amber-500">{'★'.repeat(Math.max(1, Number(row.rating) || 1))}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-600">{row.name || 'Anonymous'}</p>
              </button>
            ))}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {!selected ? (
          <p className="text-sm text-gray-500">Select a feedback item to view details.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{selected.subject || 'General Feedback'}</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {selected.name || 'Anonymous'} {selected.email ? `(${selected.email})` : ''}
                </p>
              </div>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                {selected.status || 'new'}
              </span>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{selected.comment}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => markStatus('read')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={() => markStatus('replied')}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Mark Replied
              </button>
              <button
                type="button"
                onClick={() => markStatus('new')}
                className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
              >
                Mark New
              </button>
            </div>
          </div>
        )}
        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
      </section>
    </div>
  )
}
