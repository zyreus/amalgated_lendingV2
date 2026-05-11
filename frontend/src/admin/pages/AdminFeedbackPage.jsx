import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'

const QUICK_TABS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'replied', label: 'Replied' },
  { id: 'high_rating', label: 'High Rating' },
  { id: 'low_rating', label: 'Low Rating' },
]

const CATEGORIES = [
  'Complaint',
  'Inquiry',
  'Suggestion',
  'Payment Concern',
  'Technical Issue',
  'Loan Application Concern',
  'Approval Delay',
  'Staff Feedback',
  'Website Bug',
  'Fraud Alert',
  'General Feedback',
]

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent', 'Legal Concern', 'Escalated Case']
const STATUSES = ['New', 'Read', 'Replied', 'Pending', 'In Progress', 'Escalated', 'Resolved', 'Closed', 'Archived']

function formatTimestamp(ts) {
  if (!ts) return '—'
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function avatarText(name, email) {
  const base = String(name || email || '?').trim()
  return (base[0] || '?').toUpperCase()
}

function priorityPill(priority) {
  const p = String(priority || '').toLowerCase()
  if (p.includes('urgent')) return 'bg-rose-600 text-white'
  if (p.includes('high')) return 'bg-orange-600 text-white'
  if (p.includes('medium')) return 'bg-amber-100 text-amber-900 ring-1 ring-amber-200'
  if (p.includes('low')) return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200'
  if (p.includes('legal')) return 'bg-purple-700 text-white'
  if (p.includes('escalated')) return 'bg-fuchsia-700 text-white'
  return 'bg-gray-100 text-gray-800 ring-1 ring-gray-200'
}

function statusPill(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'new') return 'bg-red-50 text-red-700 ring-1 ring-red-200'
  if (s === 'read') return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
  if (s === 'replied') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (s === 'in progress') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  if (s === 'escalated') return 'bg-fuchsia-50 text-fuchsia-800 ring-1 ring-fuchsia-200'
  if (s === 'resolved') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
  if (s === 'closed' || s === 'archived') return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
  return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
}

function buildQuery(params) {
  const q = new URLSearchParams()
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null) return
    if (typeof v === 'string' && v.trim() === '') return
    q.set(k, String(v))
  })
  const s = q.toString()
  return s ? `?${s}` : ''
}

export default function AdminFeedbackPage() {
  const [quick, setQuick] = useState('all')
  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    category: '',
    priority: '',
    status: '',
    department: '',
    assigned_staff: '',
    date_from: '',
    date_to: '',
    rating_min: '',
    rating_max: '',
    location: '',
    risk_level: '',
    payment_status: '',
  })

  const [items, setItems] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)

  const [staffOptions, setStaffOptions] = useState([])
  const [replyText, setReplyText] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const loadStaff = useCallback(async () => {
    try {
      const res = await api('/feedbacks/staff')
      const rows = Array.isArray(res?.data) ? res.data : []
      setStaffOptions(rows)
    } catch {
      setStaffOptions([])
    }
  }, [])

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api(
        `/feedbacks${buildQuery({
          quick,
          search,
          ...filters,
          per_page: 50,
        })}`,
      )
      const payload = res?.data
      const pageRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setItems(pageRows)
      setUnreadCount(pageRows.filter((x) => String(x.status || '').toLowerCase() === 'new').length)
      if (pageRows.length === 0) {
        setSelectedId(null)
      } else if (!selectedId || !pageRows.some((r) => r.id === selectedId)) {
        setSelectedId(pageRows[0].id)
      }
    } catch (err) {
      setError(err?.message || 'Unable to load feedback tickets.')
    } finally {
      setLoading(false)
    }
  }, [filters, quick, search, selectedId])

  const loadTicket = useCallback(async (id) => {
    if (!id) return
    setError('')
    try {
      const res = await api(`/feedbacks/${id}`)
      setSelected(res?.data || null)
    } catch (err) {
      setError(err?.message || 'Unable to load ticket details.')
      setSelected(null)
    }
  }, [])

  useEffect(() => {
    loadStaff()
    loadTickets()
  }, [loadStaff, loadTickets])

  useEffect(() => {
    const t = setInterval(() => loadTickets(), 25_000)
    return () => clearInterval(t)
  }, [loadTickets])

  useEffect(() => {
    if (!selectedId) return
    loadTicket(selectedId)
    setReplyText('')
    setInternalNote('')
  }, [selectedId, loadTicket])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const selectedSummary = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId])

  const onPatchTicket = useCallback(
    async (patch) => {
      if (!selectedId) return
      setBusy(true)
      setError('')
      try {
        const res = await api(`/feedbacks/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        })
        setSelected(res?.data || null)
        setToast('Ticket updated.')
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update ticket.')
      } finally {
        setBusy(false)
      }
    },
    [loadTickets, selectedId],
  )

  const onPublicationAction = useCallback(
    async (path, body = {}) => {
      if (!selectedId) return
      setBusy(true)
      setError('')
      try {
        const res = await api(`/feedbacks/${selectedId}${path}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
        setSelected(res?.data || null)
        setToast('Publication updated.')
        await loadTicket(selectedId)
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update publication.')
      } finally {
        setBusy(false)
      }
    },
    [loadTicket, loadTickets, selectedId],
  )

  const onSetStatus = useCallback(
    async (status) => {
      if (!selectedId) return
      setBusy(true)
      setError('')
      try {
        const res = await api(`/feedbacks/${selectedId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
        setSelected(res?.data || null)
        setToast(`Status set to ${status}.`)
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update status.')
      } finally {
        setBusy(false)
      }
    },
    [loadTickets, selectedId],
  )

  const onSendReply = useCallback(
    async ({ isInternal }) => {
      if (!selectedId) return
      const message = (isInternal ? internalNote : replyText).trim()
      if (!message) return

      setBusy(true)
      setError('')
      try {
        await api(`/feedbacks/${selectedId}/replies`, {
          method: 'POST',
          body: JSON.stringify({ message, is_internal: !!isInternal }),
        })
        setToast(isInternal ? 'Internal note saved.' : 'Reply sent.')
        if (isInternal) setInternalNote('')
        else setReplyText('')
        await loadTicket(selectedId)
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to send message.')
      } finally {
        setBusy(false)
      }
    },
    [internalNote, loadTicket, loadTickets, replyText, selectedId],
  )

  const onDeleteTicket = useCallback(async () => {
    if (!selectedId) return
    if (!window.confirm('Delete this feedback ticket permanently?')) return

    setBusy(true)
    setError('')
    try {
      await api(`/feedbacks/${selectedId}`, { method: 'DELETE' })
      setToast('Ticket deleted.')
      setSelected(null)
      setSelectedId(null)
      await loadTickets()
    } catch (err) {
      setError(err?.message || 'Unable to delete ticket.')
    } finally {
      setBusy(false)
    }
  }, [loadTickets, selectedId])

  const customer = selected?.contact || null
  const loan = selected?.loan_context || null

  return (
    <div className="grid min-h-[74vh] gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm xl:sticky xl:top-20 xl:h-[calc(100dvh-9rem)] xl:min-h-[640px] xl:overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-900">Customer Relationship & Feedback Center</h2>
            <p className="mt-1 text-xs text-gray-500">Unified complaints, inquiries, and retention touchpoints</p>
          </div>
          <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">{unreadCount} new</span>
        </div>

        <label className="mt-3 block">
          <span className="sr-only">Search tickets</span>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(e) => (e.key === 'Enter' ? loadTickets() : null)}
            placeholder="Search subject, message, email, phone..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none ring-red-200 transition focus:border-red-200 focus:bg-white focus:ring-2"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {QUICK_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setQuick(tab.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                quick === tab.id ? 'bg-red-600 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`ml-auto rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
              filtersOpen ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            Filters
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => loadTickets()}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {filtersOpen ? (
          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Category</span>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</span>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</span>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">All</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assigned Staff</span>
                <select
                  value={filters.assigned_staff}
                  onChange={(e) => setFilters((p) => ({ ...p, assigned_staff: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                >
                  <option value="">Any</option>
                  {staffOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date from</span>
                <input
                  type="date"
                  value={filters.date_from}
                  onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date to</span>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => loadTickets()}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-black"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({
                    category: '',
                    priority: '',
                    status: '',
                    department: '',
                    assigned_staff: '',
                    date_from: '',
                    date_to: '',
                    rating_min: '',
                    rating_max: '',
                    location: '',
                    risk_level: '',
                    payment_status: '',
                  })
                  setQuick('all')
                }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-2 overflow-y-auto pr-1 xl:max-h-[calc(100%-16.5rem)]">
          {loading ? <p className="text-sm text-gray-500">Loading tickets…</p> : null}
          {!loading && items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-700">No tickets found</p>
              <p className="mt-1 text-xs text-gray-500">Adjust filters or search keywords.</p>
            </div>
          ) : null}

          {items.map((row) => {
            const who = row?.borrower?.name || row?.email || 'Unknown customer'
            const letter = avatarText(row?.borrower?.name, row?.email)
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedId === row.id ? 'border-red-300 bg-red-50/40 shadow-sm' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
                    {letter}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{row.subject || 'General Feedback'}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill(row.status)}`}>
                        {row.status || 'New'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-600">{who}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{row.message || 'No message body'}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityPill(row.priority)}`}>
                        {row.priority || 'Medium'}
                      </span>
                      <span className="text-[11px] text-gray-500">{formatTimestamp(row.created_at)}</span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        {!selectedId ? (
          <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <div>
              <p className="text-base font-semibold text-gray-800">No ticket selected</p>
              <p className="mt-1 text-sm text-gray-500">Pick an item from the inbox to manage it.</p>
            </div>
          </div>
        ) : !selected ? (
          <div className="min-h-[420px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6">
            <p className="text-sm font-medium text-gray-700">Loading ticket…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl font-semibold text-gray-900">{selected.subject || 'General Feedback'}</h3>
                  {selected.is_vip ? <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">VIP</span> : null}
                  {selected.is_sensitive ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-900">Sensitive</span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-gray-600">{customer?.full_name || selectedSummary?.email || 'Customer'}</p>
                <p className="text-xs text-gray-500">
                  {customer?.email || 'No email'} • {formatTimestamp(selected.created_at)}
                </p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Source: <span className="font-semibold text-gray-700">{selected.source || '—'}</span>
                  {' · '}
                  Website:{' '}
                  <span className="font-semibold text-gray-700">{selected.publication_status || 'pending'}</span>
                  {selected.featured ? (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                      Featured
                    </span>
                  ) : null}
                  {typeof selected.rating === 'number' ? (
                    <span className="ml-1 text-amber-600">★ {selected.rating}/5</span>
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${priorityPill(selected.priority)}`}>{selected.priority}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPill(selected.status)}`}>{selected.status}</span>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer message</p>
                  <textarea
                    key={`msg-main-${selectedId}`}
                    rows={6}
                    defaultValue={selected.message || ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      const prev = String(selected.message || '').trim()
                      if (v === prev) return
                      onPatchTicket({ message: v })
                    }}
                    disabled={busy}
                    className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </div>

              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Classification & workflow</p>

                  <div className="mt-3 grid gap-2">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Category</span>
                      <select
                        value={selected.category || 'General Feedback'}
                        onChange={(e) => onPatchTicket({ category: e.target.value })}
                        disabled={busy}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</span>
                      <select
                        value={selected.priority || 'Medium'}
                        onChange={(e) => onPatchTicket({ priority: e.target.value })}
                        disabled={busy}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                      >
                        {PRIORITIES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</span>
                      <select
                        value={selected.status || 'New'}
                        onChange={(e) => onSetStatus(e.target.value)}
                        disabled={busy}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assign to staff</span>
                      <select
                        value={selected.assigned_staff?.id || ''}
                        onChange={(e) => onPatchTicket({ assigned_staff_id: e.target.value ? Number(e.target.value) : null })}
                        disabled={busy}
                        className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                      >
                        <option value="">Unassigned</option>
                        {staffOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">SLA (min)</span>
                        <input
                          type="number"
                          min={1}
                          max={10080}
                          value={selected.sla_minutes || ''}
                          onChange={(e) => onPatchTicket({ sla_minutes: e.target.value ? Number(e.target.value) : null })}
                          disabled={busy}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                          placeholder="e.g. 60"
                        />
                      </label>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
                        <p className="text-[11px] font-semibold text-gray-500">SLA due</p>
                        <p className={`mt-1 text-xs font-semibold ${selected.sla_breached ? 'text-red-700' : 'text-gray-900'}`}>
                          {selected.sla_due_at ? formatTimestamp(selected.sla_due_at) : '—'}
                        </p>
                        {selected.sla_breached ? <p className="mt-0.5 text-[11px] font-semibold text-red-700">Breach warning</p> : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Follow-up</span>
                        <input
                          type="datetime-local"
                          value={selected.follow_up_at ? new Date(selected.follow_up_at).toISOString().slice(0, 16) : ''}
                          onChange={(e) => onPatchTicket({ follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          disabled={busy}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resolution deadline</span>
                        <input
                          type="datetime-local"
                          value={selected.resolution_deadline_at ? new Date(selected.resolution_deadline_at).toISOString().slice(0, 16) : ''}
                          onChange={(e) => onPatchTicket({ resolution_deadline_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                          disabled={busy}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onSetStatus('Archived')}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        Archive
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={onDeleteTicket}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>

                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Public website testimonials</p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Homepage carousel loads approved + featured + borrower consent + rating ≥ 4 (5-minute file cache; no Redis).
                      </p>
                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={!!selected.consent_public_display}
                          disabled={busy}
                          onChange={(e) => onPatchTicket({ consent_public_display: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Borrower consented to public display
                      </label>
                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                        <input
                          type="checkbox"
                          checked={!!selected.website_visible}
                          disabled={busy}
                          onChange={(e) => onPatchTicket({ website_visible: e.target.checked })}
                          className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        Legacy “show on website” flag
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPublicationAction('/approve', {})}
                          className="rounded-lg bg-emerald-600 px-2 py-2 text-[11px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPublicationAction('/reject', {})}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-2 text-[11px] font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPublicationAction('/feature', {})}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                        >
                          Feature
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onPublicationAction('/unfeature', {})}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-[11px] font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                        >
                          Unfeature
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={busy || !!selected.verified_borrower}
                        onClick={() => onPublicationAction('/verify-borrower', {})}
                        className="mt-2 w-full rounded-lg border border-sky-200 bg-sky-50 px-2 py-2 text-[11px] font-semibold text-sky-900 transition hover:bg-sky-100 disabled:opacity-60"
                      >
                        {selected.verified_borrower ? 'Verified borrower' : 'Mark verified borrower'}
                      </button>
                      <label className="mt-2 block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Display name (optional)
                        </span>
                        <input
                          key={`author-${selectedId}`}
                          type="text"
                          maxLength={120}
                          defaultValue={selected.public_author_label || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            const prev = (selected.public_author_label || '').trim()
                            if (v === prev) return
                            onPatchTicket({ public_author_label: v || null })
                          }}
                          disabled={busy}
                          placeholder="e.g. Maria L."
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Loan type (public)
                        </span>
                        <input
                          key={`loantype-${selectedId}`}
                          type="text"
                          maxLength={96}
                          defaultValue={selected.loan_type || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            const prev = (selected.loan_type || '').trim()
                            if (v === prev) return
                            onPatchTicket({ loan_type: v || null })
                          }}
                          disabled={busy}
                          placeholder="e.g. Salary loan"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          Admin notes
                        </span>
                        <textarea
                          key={`notes-${selectedId}`}
                          rows={3}
                          defaultValue={selected.admin_notes || ''}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            const prev = String(selected.admin_notes || '').trim()
                            if (v === prev) return
                            onPatchTicket({ admin_notes: v || null })
                          }}
                          disabled={busy}
                          className="w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                        />
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPatchTicket({ is_sensitive: !selected.is_sensitive })}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          selected.is_sensitive ? 'bg-purple-700 text-white hover:bg-purple-800' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        Sensitive
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPatchTicket({ is_vip: !selected.is_vip })}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          selected.is_vip ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        VIP
                      </button>
                    </div>
                  </div>
                </div>

              </aside>
            </div>
          </div>
        )}

        {error ? <p className="mt-4 text-sm font-medium text-red-600">{error}</p> : null}
        {toast ? (
          <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">{toast}</div>
        ) : null}
      </section>
    </div>
  )
}
