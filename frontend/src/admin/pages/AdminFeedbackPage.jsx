import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'

const QUICK_TABS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: 'New' },
  { id: 'read', label: 'Read' },
  { id: 'replied', label: 'Replied' },
  { id: 'high_rating', label: 'High Rating' },
  { id: 'low_rating', label: 'Low Rating' },
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
  if (s === 'read') return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
  if (s === 'replied') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (s === 'in progress') return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
  if (s === 'escalated') return 'bg-fuchsia-50 text-fuchsia-800 ring-1 ring-fuchsia-200'
  if (s === 'resolved') return 'bg-teal-50 text-teal-800 ring-1 ring-teal-200'
  if (s === 'closed' || s === 'archived') return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
  return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
}

function publicationPill(pub, featured) {
  const p = String(pub || 'pending').toLowerCase()
  if (p === 'approved') {
    return featured
      ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-300'
      : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
  }
  if (p === 'rejected') return 'bg-white text-rose-800 ring-1 ring-rose-400'
  return 'bg-slate-50 text-slate-600 ring-1 ring-slate-200'
}

function ticketListAccent(row) {
  const pub = String(row?.publication_status || 'pending').toLowerCase()
  if (pub === 'approved' && row?.featured) return 'border-l-amber-500'
  if (pub === 'approved') return 'border-l-emerald-500'
  if (pub === 'rejected') return 'border-l-rose-500'
  const s = String(row?.status || '').toLowerCase()
  if (s === 'new') return 'border-l-red-500'
  if (s === 'read') return 'border-l-gray-400'
  return 'border-l-transparent'
}

function TicketListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <div className="flex gap-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-gray-200" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3.5 w-[72%] rounded bg-gray-200" />
              <div className="h-3 w-[55%] rounded bg-gray-100" />
              <div className="h-3 w-full rounded bg-gray-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
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
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
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
  const [page, setPage] = useState(1)
  const [pageMeta, setPageMeta] = useState({ last_page: 1, total: 0, current_page: 1 })

  const [staffOptions, setStaffOptions] = useState([])
  const [busy, setBusy] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  /** { id, subject } when delete confirmation modal is open */
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadStaff = useCallback(async () => {
    try {
      const res = await api('/feedbacks/staff')
      const rows = Array.isArray(res?.data) ? res.data : []
      setStaffOptions(rows)
    } catch {
      setStaffOptions([])
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(searchInput.trim()), 400)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [quick, searchDebounced, filters])

  const loadTickets = useCallback(async () => {
    setListLoading(true)
    setError('')
    try {
      const res = await api(
        `/feedbacks${buildQuery({
          quick,
          search: searchDebounced,
          ...filters,
          per_page: 20,
          page,
        })}`,
      )
      const payload = res?.data
      const pageRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setItems(pageRows)
      setPageMeta({
        current_page: Number(payload?.current_page) || 1,
        last_page: Number(payload?.last_page) || 1,
        total: Number(payload?.total) || pageRows.length,
      })
      setUnreadCount(pageRows.filter((x) => String(x.status || '').toLowerCase() === 'new').length)
      if (pageRows.length === 0) {
        setSelectedId(null)
      } else {
        setSelectedId((prev) => (prev && pageRows.some((r) => r.id === prev) ? prev : pageRows[0].id))
      }
    } catch (err) {
      setError(err?.message || 'Unable to load feedback tickets.')
    } finally {
      setListLoading(false)
    }
  }, [filters, page, quick, searchDebounced])

  const loadTicket = useCallback(async (id) => {
    if (!id) return
    setDetailLoading(true)
    setSelected(null)
    setError('')
    try {
      const res = await api(`/feedbacks/${id}`)
      setSelected(res?.data || null)
    } catch (err) {
      setError(err?.message || 'Unable to load ticket details.')
      setSelected(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') loadTickets()
    }, 30_000)
    return () => window.clearInterval(id)
  }, [loadTickets])

  useEffect(() => {
    if (!selectedId) return
    loadTicket(selectedId)
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

  const openDeleteModal = useCallback(() => {
    if (!selectedId) return
    const subject = String(selected?.subject || selectedSummary?.subject || '').trim() || 'General Feedback'
    setDeleteConfirm({ id: selectedId, subject })
  }, [selected?.subject, selectedId, selectedSummary?.subject])

  const performDeleteTicket = useCallback(async () => {
    const id = deleteConfirm?.id
    if (!id) return
    setError('')
    try {
      await api(`/feedbacks/${id}`, { method: 'DELETE' })
      setToast('Ticket deleted.')
      if (selectedId === id) {
        setSelected(null)
        setSelectedId(null)
      }
      await loadTickets()
    } catch (err) {
      setError(err?.message || 'Unable to delete ticket.')
      throw err
    }
  }, [deleteConfirm?.id, loadTickets, selectedId])

  const customer = selected?.contact || null
  const loan = selected?.loan_context || null

  const workflowAside = selectedId && selected
  const asidePlaceholder =
    !selectedId
      ? 'Select a ticket from the inbox to manage classification, SLA, publication, and VIP flags.'
      : detailLoading
        ? 'Loading ticket details…'
        : 'Workflow controls appear once this ticket is available.'

  return (
    <>
    <div className="grid min-h-[72vh] grid-cols-1 gap-6 lg:grid-cols-[minmax(240px,34%)_minmax(0,1fr)] lg:grid-rows-[auto_auto] lg:items-stretch xl:grid-cols-[minmax(0,24fr)_minmax(0,46fr)_minmax(0,30fr)] xl:grid-rows-[1fr] xl:items-stretch">
      <section className="flex h-full min-h-0 max-h-none flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/[0.04] lg:row-span-2 lg:max-h-[calc(100dvh-6rem)] xl:row-span-1 xl:max-h-[calc(100dvh-8.5rem)] xl:min-h-0 xl:sticky xl:top-20">
        <div className="shrink-0 space-y-4 border-b border-gray-100 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold leading-snug text-gray-900">Feedback inbox</h2>
              <p className="mt-1 text-[11px] leading-snug text-gray-500">Complaints, inquiries, and testimonial pipeline</p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-100">
              {unreadCount} new
            </span>
          </div>

          <label className="block">
            <span className="sr-only">Search tickets</span>
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSearchDebounced(searchInput.trim())
              }}
              placeholder="Search subject, message, email, phone…"
              className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-100"
            />
          </label>

          <div className="flex w-full flex-wrap items-center gap-2">
            {QUICK_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQuick(tab.id)}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold transition ${
                  quick === tab.id ? 'bg-red-600 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-semibold transition ${
                  filtersOpen ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                }`}
              >
                Filters
              </button>
              <button
                type="button"
                disabled={listLoading}
                onClick={() => loadTickets()}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Refresh
              </button>
            </span>
          </div>
        </div>

        {filtersOpen ? (
          <div className="shrink-0 border-b border-gray-100 bg-gray-50/90 px-5 py-4">
            <div className="grid gap-2 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</span>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200"
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
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200"
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
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200"
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
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Date to</span>
                <input
                  type="date"
                  value={filters.date_to}
                  onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-red-200"
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

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 pr-3">
            {listLoading ? <TicketListSkeleton /> : null}
            {!listLoading && items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                <p className="text-sm font-medium text-gray-700">No tickets on this page</p>
                <p className="mt-1 text-xs text-gray-500">Try another tab, page, or search.</p>
              </div>
            ) : null}

            {!listLoading
              ? items.map((row) => {
                  const who = row?.full_name || row?.borrower?.name || row?.email || 'Unknown customer'
                  const letter = avatarText(row?.full_name || row?.borrower?.name, row?.email)
                  const pub = String(row?.publication_status || 'pending').toLowerCase()
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`flex min-h-[7.75rem] w-full flex-col rounded-xl border-l-4 border border-gray-200 bg-white p-3.5 text-left shadow-sm ring-1 ring-black/[0.03] transition hover:border-gray-300 hover:shadow-md ${
                        selectedId === row.id
                          ? 'border-l-red-500 bg-red-50/40 ring-2 ring-red-400/90 ring-offset-1 ring-offset-white'
                          : ticketListAccent(row)
                      }`}
                    >
                      <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-100 to-gray-200 text-xs font-bold text-gray-700">
                            {letter}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{row.subject || 'General Feedback'}</p>
                              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusPill(row.status)}`}>
                                {row.status || 'New'}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-1 text-xs text-gray-600">{who}</p>
                            <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500">{row.message || 'No message body'}</p>
                          </div>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityPill(row.priority)}`}>
                            {row.priority || 'Medium'}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${publicationPill(row.publication_status, row.featured)}`}>
                            {row.featured ? 'Featured' : pub === 'approved' ? 'Approved' : pub === 'rejected' ? 'Rejected' : 'Pending'}
                          </span>
                          {row.verified_borrower ? (
                            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200">
                              Verified
                            </span>
                          ) : null}
                          <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-gray-400">{formatTimestamp(row.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  )
                })
              : null}
          </div>

          {pageMeta.last_page > 1 ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3">
              <button
                type="button"
                disabled={listLoading || page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Previous
              </button>
              <p className="text-center text-[11px] text-gray-600">
                Page <span className="font-semibold text-gray-900">{pageMeta.current_page}</span> of{' '}
                <span className="font-semibold text-gray-900">{pageMeta.last_page}</span>
                <span className="hidden sm:inline"> · {pageMeta.total} total</span>
              </p>
              <button
                type="button"
                disabled={listLoading || page >= pageMeta.last_page}
                onClick={() => setPage((p) => Math.min(pageMeta.last_page, p + 1))}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="flex h-full min-h-0 min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/[0.04] lg:col-start-2 lg:row-start-1 xl:col-start-2 xl:row-start-1">
        {!selectedId ? (
          <div className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <div>
              <p className="text-base font-semibold text-gray-800">No ticket selected</p>
              <p className="mt-1 text-sm text-gray-500">Pick an item from the inbox to manage it.</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="min-h-[420px] space-y-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-6">
            <div className="h-6 w-[55%] animate-pulse rounded-md bg-gray-200" />
            <div className="h-4 w-[38%] animate-pulse rounded-md bg-gray-100" />
            <div className="h-40 animate-pulse rounded-xl bg-gray-100" />
            <p className="text-xs text-gray-500">Loading ticket details…</p>
          </div>
        ) : !selected ? (
          <div className="grid min-h-[320px] place-items-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <div>
              <p className="text-sm font-semibold text-gray-800">Could not load this ticket</p>
              <p className="mt-1 text-xs text-gray-500">Refresh the list or pick another item.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="min-w-0 truncate text-xl font-semibold tracking-tight text-gray-900">{selected.subject || 'General Feedback'}</h3>
                  {selected.is_vip ? <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-900">VIP</span> : null}
                  {selected.is_sensitive ? (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[11px] font-semibold text-purple-900">Sensitive</span>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-gray-800">{customer?.full_name || selectedSummary?.email || 'Customer'}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                  <span className="break-all">{customer?.email || 'No email'}</span>
                  <span className="hidden text-gray-300 sm:inline" aria-hidden>
                    ·
                  </span>
                  <span className="tabular-nums text-gray-500">{formatTimestamp(selected.created_at)}</span>
                </div>
                <p className="text-[11px] leading-relaxed text-gray-500">
                  Publication: <span className="font-semibold text-gray-700">{selected.publication_status || 'pending'}</span>
                  {selected.featured ? (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">Featured</span>
                  ) : null}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap sm:items-center">
                <div className="flex flex-wrap justify-end gap-2 sm:justify-end">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${priorityPill(selected.priority)}`}>{selected.priority}</span>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusPill(selected.status)}`}>{selected.status}</span>
                </div>
                {typeof selected.rating === 'number' ? (
                  <span className="text-sm font-semibold tabular-nums text-amber-600">★ {selected.rating}/5</span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-1">
              <div className="space-y-5">
                <div className="rounded-xl border border-gray-200 bg-gradient-to-b from-white to-gray-50/80 p-5 shadow-sm ring-1 ring-black/[0.03]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Customer</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                      {selected.source || 'unknown'}
                    </span>
                    {typeof selected.rating === 'number' ? (
                      <span className="text-sm font-semibold tabular-nums text-amber-600">★ {selected.rating}/5</span>
                    ) : null}
                    {loan?.loan_product_applied ? (
                      <span className="text-xs text-gray-600">Product: {loan.loan_product_applied}</span>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-5 ring-1 ring-black/[0.03]">
                  <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Customer message</p>
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
                    className="max-h-[min(280px,42vh)] min-h-[120px] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-800 outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <aside
        className={`flex min-h-0 min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm ring-1 ring-black/[0.04] lg:col-start-2 lg:row-start-2 xl:col-start-3 xl:row-start-1 ${workflowAside ? '' : 'hidden lg:block'} h-full xl:max-h-[calc(100dvh-8.5rem)] xl:overflow-y-auto xl:overflow-x-hidden xl:sticky xl:top-20`}
      >
        {workflowAside ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status & assignment</p>

            <div className="mt-4 grid min-h-0 flex-1 auto-rows-min gap-3">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Priority</span>
                <select
                  value={selected.priority || 'Medium'}
                  onChange={(e) => onPatchTicket({ priority: e.target.value })}
                  disabled={busy}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status</span>
                <select
                  value={selected.status || 'New'}
                  onChange={(e) => onSetStatus(e.target.value)}
                  disabled={busy}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Assign to staff</span>
                <select
                  value={selected.assigned_staff?.id || ''}
                  onChange={(e) => onPatchTicket({ assigned_staff_id: e.target.value ? Number(e.target.value) : null })}
                  disabled={busy}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {staffOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Follow-up</span>
                  <input
                    type="datetime-local"
                    value={selected.follow_up_at ? new Date(selected.follow_up_at).toISOString().slice(0, 16) : ''}
                    onChange={(e) => onPatchTicket({ follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    disabled={busy}
                    className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Resolution deadline</span>
                  <input
                    type="datetime-local"
                    value={selected.resolution_deadline_at ? new Date(selected.resolution_deadline_at).toISOString().slice(0, 16) : ''}
                    onChange={(e) => onPatchTicket({ resolution_deadline_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    disabled={busy}
                    className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-2 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onSetStatus('Archived')}
                  className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                >
                  Archive
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={openDeleteModal}
                  className="h-10 w-full min-w-0 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>

              <div className="space-y-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/90 p-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Public website testimonials</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                    Published items appear on the homepage in <span className="font-semibold text-gray-700">Customer feedback</span>{' '}
                    (“What our borrowers say”). Use <span className="font-semibold text-gray-700">Approve</span> and{' '}
                    <span className="font-semibold text-gray-700">Feature</span>, turn on borrower consent, and keep rating at
                    least the site minimum (usually 4★) with a short message. A display name may be required. Cached updates
                    can take a few minutes.
                  </p>
                </div>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!selected.consent_public_display}
                    disabled={busy}
                    onChange={(e) => onPatchTicket({ consent_public_display: e.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Borrower consented to public display</span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={!!selected.website_visible}
                    disabled={busy}
                    onChange={(e) => onPatchTicket({ website_visible: e.target.checked })}
                    className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
                  />
                  <span>Legacy “show on website” flag</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPublicationAction('/approve', {})}
                    className="h-10 w-full min-w-0 rounded-lg bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPublicationAction('/reject', {})}
                    className="h-10 w-full min-w-0 rounded-lg border border-rose-200 bg-rose-50 text-sm font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPublicationAction('/feature', {})}
                    className="h-10 w-full min-w-0 rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                  >
                    Feature
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onPublicationAction('/unfeature', {})}
                    className="h-10 w-full min-w-0 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    Unfeature
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy || !!selected.verified_borrower}
                  onClick={() => onPublicationAction('/verify-borrower', {})}
                  className="h-10 w-full rounded-lg border border-sky-200 bg-sky-50 text-sm font-semibold text-sky-900 transition hover:bg-sky-100 disabled:opacity-60"
                >
                  {selected.verified_borrower ? 'Verified borrower' : 'Mark verified borrower'}
                </button>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Display name (optional)</span>
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
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Loan type (public)</span>
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
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Admin notes</span>
                  <textarea
                    key={`notes-${selectedId}`}
                    rows={4}
                    defaultValue={selected.admin_notes || ''}
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      const prev = String(selected.admin_notes || '').trim()
                      if (v === prev) return
                      onPatchTicket({ admin_notes: v || null })
                    }}
                    disabled={busy}
                    className="min-h-[5.5rem] w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-red-200 disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPatchTicket({ is_sensitive: !selected.is_sensitive })}
                  className={`h-10 w-full min-w-0 rounded-lg text-sm font-semibold transition ${
                    selected.is_sensitive ? 'bg-purple-700 text-white hover:bg-purple-800' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  Sensitive
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPatchTicket({ is_vip: !selected.is_vip })}
                  className={`h-10 w-full min-w-0 rounded-lg text-sm font-semibold transition ${
                    selected.is_vip ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  VIP
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex min-h-[12rem] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center">
            <p className="max-w-[16rem] text-sm leading-relaxed text-gray-600">{asidePlaceholder}</p>
          </div>
        )}
      </aside>

      {error ? <p className="col-span-full mt-1 text-sm font-medium text-red-600">{error}</p> : null}
      {toast ? (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-xl">{toast}</div>
      ) : null}
    </div>

    <ConfirmModal
      open={deleteConfirm != null}
      onClose={() => setDeleteConfirm(null)}
      title="Delete feedback ticket?"
      description={
        deleteConfirm
          ? `This permanently removes “${deleteConfirm.subject}” (ticket #${deleteConfirm.id}) and its CRM thread. You cannot undo this action.`
          : ''
      }
      confirmLabel="Delete permanently"
      cancelLabel="Cancel"
      tone="danger"
      onConfirm={performDeleteTicket}
    />
    </>
  )
}
