import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe,
  Loader2,
  MessagesSquare,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react'
import { api } from '../api/client.js'
import ConfirmModal from '../components/ConfirmModal.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  FEEDBACK_TYPES,
  QUICK_TABS,
  avatarText,
  countByFeedbackType,
  formatTimestamp,
  priorityMeta,
  publicationMeta,
  resolveFeedbackType,
  statusMeta,
} from '../utils/feedbackInboxMeta.js'
import { starFillLevels } from '../../utils/feedbackRating.js'

const TYPE_TAB_ORDER = ['all', 'testimonial', 'complaint', 'inquiry', 'chatbot', 'general']

const listItemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04, duration: 0.28, ease: [0.22, 1, 0.36, 1] } }),
  exit: { opacity: 0, x: -8, transition: { duration: 0.15 } },
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

function resolveApprovePublicLabel(selected, inputValue) {
  const fromInput = String(inputValue || '').trim()
  if (fromInput) return fromInput
  const fromState = String(selected?.public_author_label || '').trim()
  if (fromState) return fromState
  const hasName = String(selected?.full_name || selected?.contact?.full_name || '').trim()
  const hasEmail = String(selected?.contact?.email || '').trim()
  if (!hasName && !hasEmail) return 'Verified Customer'
  return undefined
}

function StarRating({ value, size = 'sm' }) {
  const fills = starFillLevels(value)
  const iconClass = size === 'lg' ? 'size-5' : 'size-3.5'
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {fills.map((fill, index) => (
        <span key={index} className="relative inline-block">
          <Star className={`${iconClass} text-gray-200`} strokeWidth={1.75} />
          <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
            <Star className={`${iconClass} fill-amber-400 text-amber-400`} strokeWidth={1.75} />
          </span>
        </span>
      ))}
      {typeof value === 'number' ? (
        <span className={`ml-1 font-semibold tabular-nums text-amber-600 ${size === 'lg' ? 'text-base' : 'text-xs'}`}>
          {value}/5
        </span>
      ) : null}
    </span>
  )
}

function TypeIcon({ typeId, className = 'size-4' }) {
  const meta = FEEDBACK_TYPES[typeId] || FEEDBACK_TYPES.general
  const Icon = meta.icon
  return <Icon className={className} strokeWidth={2} />
}

function FeedbackTypeBadge({ row, compact = false, onDark = false }) {
  const typeId = resolveFeedbackType(row)
  const meta = FEEDBACK_TYPES[typeId] || FEEDBACK_TYPES.general
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
        onDark ? 'bg-white/15 text-white ring-white/25' : meta.chip
      } ${compact ? '' : 'uppercase tracking-wide'}`}
    >
      <TypeIcon typeId={typeId} className="size-3" />
      {meta.shortLabel}
    </span>
  )
}

function HeaderMetaPill({ label }) {
  return (
    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm">
      {label}
    </span>
  )
}

function TicketListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-100 bg-white/80 px-3.5 py-3.5">
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-200" />
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

export default function AdminFeedbackPage() {
  const { showToast } = useToast()
  const [quick, setQuick] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [searchDebounced, setSearchDebounced] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState({
    department: '',
    date_from: '',
    date_to: '',
    rating_min: '',
    rating_max: '',
    location: '',
    risk_level: '',
    payment_status: '',
    include_archived: false,
    pub_status: '',
    audience: '',
    featured_only: false,
  })

  const [items, setItems] = useState([])
  const [featuredSlots, setFeaturedSlots] = useState({ used: 0, max: 3 })
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedId, setSelectedId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [page, setPage] = useState(1)
  const [pageMeta, setPageMeta] = useState({ last_page: 1, total: 0, current_page: 1 })

  const [busy, setBusy] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const publicAuthorLabelRef = useRef(null)

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
      const { include_archived, featured_only, ...filterQuery } = filters
      const res = await api(
        `/feedbacks${buildQuery({
          quick,
          search: searchDebounced,
          ...filterQuery,
          ...(include_archived ? { include_archived: 1 } : {}),
          ...(featured_only ? { featured_only: 1 } : {}),
          per_page: 20,
          page,
        })}`,
      )
      const payload = res?.data
      const pageRows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
      setFeaturedSlots(
        payload?.featured_slots && typeof payload.featured_slots === 'object'
          ? { used: Number(payload.featured_slots.used) || 0, max: Number(payload.featured_slots.max) || 3 }
          : { used: 0, max: 3 },
      )
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

  const typeCounts = useMemo(() => countByFeedbackType(items), [items])

  const visibleItems = useMemo(() => {
    if (typeFilter === 'all') return items
    return items.filter((row) => resolveFeedbackType(row) === typeFilter)
  }, [items, typeFilter])

  const selectedSummary = useMemo(() => items.find((x) => x.id === selectedId) || null, [items, selectedId])
  const selectedType = selected ? resolveFeedbackType(selected) : null
  const selectedTypeMeta = selectedType ? FEEDBACK_TYPES[selectedType] : null

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
        showToast('Ticket updated.', 'success')
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update ticket.')
      } finally {
        setBusy(false)
      }
    },
    [loadTickets, selectedId, showToast],
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
        if (path === '/approve') {
          showToast('Feedback approved and published to website successfully.', 'success')
        } else {
          showToast('Publication updated.', 'success')
        }
        await loadTicket(selectedId)
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update publication.')
      } finally {
        setBusy(false)
      }
    },
    [loadTicket, loadTickets, selectedId, showToast],
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
        showToast(`Status set to ${status}.`, 'success')
        await loadTickets()
      } catch (err) {
        setError(err?.message || 'Unable to update status.')
      } finally {
        setBusy(false)
      }
    },
    [loadTickets, selectedId, showToast],
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
      showToast('Ticket deleted.', 'success')
      if (selectedId === id) {
        setSelected(null)
        setSelectedId(null)
      }
      await loadTickets()
    } catch (err) {
      setError(err?.message || 'Unable to delete ticket.')
      throw err
    }
  }, [deleteConfirm?.id, loadTickets, selectedId, showToast])

  const customer = selected?.contact || null
  const loan = selected?.loan_context || null
  const submitterName =
    customer?.full_name ||
    selected?.full_name ||
    selectedSummary?.full_name ||
    selectedSummary?.borrower?.name ||
    'Unknown customer'

  return (
    <>
      <div className="grid min-h-[calc(100dvh-8.5rem)] grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,26rem)_minmax(0,1fr)] xl:items-stretch">
        {/* —— Inbox sidebar —— */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-lg ring-1 ring-black/[0.04] xl:sticky xl:top-20 xl:max-h-[calc(100dvh-8.5rem)]">
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] px-5 pb-5 pt-5 text-white">
            <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 left-4 size-24 rounded-full bg-black/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-red-100/90">CRM</p>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-tight">Feedback inbox</h2>
                <p className="mt-1 text-xs leading-snug text-red-100/85">Complaints, inquiries & testimonial pipeline</p>
              </div>
              <motion.span
                key={unreadCount}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="inline-flex shrink-0 items-center rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white ring-1 ring-white/25 backdrop-blur-sm"
              >
                {unreadCount} new
              </motion.span>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-red-200/80" />
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setSearchDebounced(searchInput.trim())
                }}
                placeholder="Search subject, message, email…"
                className="h-10 w-full rounded-xl border border-white/20 bg-white/10 pl-10 pr-3 text-sm text-white placeholder:text-red-100/70 outline-none backdrop-blur-sm transition focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/20"
              />
            </div>
          </div>

          <div className="shrink-0 space-y-3 border-b border-gray-100 bg-[#fff9ed]/60 px-4 py-3">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {TYPE_TAB_ORDER.map((typeId) => {
                const meta = typeId === 'all' ? null : FEEDBACK_TYPES[typeId]
                const active = typeFilter === typeId
                const count = typeCounts[typeId] ?? 0
                const Icon = typeId === 'all' ? MessagesSquare : meta?.icon || MessagesSquare
                return (
                  <button
                    key={typeId}
                    type="button"
                    onClick={() => setTypeFilter(typeId)}
                    className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-all duration-200 sm:text-[11px] ${
                      active
                        ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/20'
                        : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-primary/30 hover:bg-red-50/50'
                    }`}
                  >
                    <Icon className="size-3 shrink-0" strokeWidth={2.25} />
                    <span className="truncate">{typeId === 'all' ? 'All' : meta?.label}</span>
                    <span className={`shrink-0 rounded-full px-1 py-0.5 text-[9px] tabular-nums ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {QUICK_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setQuick(tab.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                    quick === tab.id
                      ? 'bg-brand-primary text-white'
                      : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                  filtersOpen ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50'
                }`}
              >
                <Filter className="size-3" />
                Filters
              </button>
              <button
                type="button"
                disabled={listLoading}
                onClick={() => loadTickets()}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className={`size-3 ${listLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="shrink-0 overflow-hidden border-b border-gray-100 bg-gray-50/90"
              >
                <div className="space-y-3 px-4 py-4">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Date from</span>
                      <input
                        type="date"
                        value={filters.date_from}
                        onChange={(e) => setFilters((p) => ({ ...p, date_from: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Date to</span>
                      <input
                        type="date"
                        value={filters.date_to}
                        onChange={(e) => setFilters((p) => ({ ...p, date_to: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20"
                      />
                    </label>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!filters.featured_only}
                      onChange={(e) => setFilters((p) => ({ ...p, featured_only: e.target.checked }))}
                      className="size-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    Featured only
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Publication</span>
                      <select
                        value={filters.pub_status}
                        onChange={(e) => setFilters((p) => ({ ...p, pub_status: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        <option value="">All</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-500">Audience</span>
                      <select
                        value={filters.audience}
                        onChange={(e) => setFilters((p) => ({ ...p, audience: e.target.value }))}
                        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-primary/20"
                      >
                        <option value="">All</option>
                        <option value="borrower">Borrower (linked)</option>
                        <option value="customer">Customer (public)</option>
                      </select>
                    </label>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={!!filters.include_archived}
                      onChange={(e) => setFilters((p) => ({ ...p, include_archived: e.target.checked }))}
                      className="size-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                    />
                    Show archived tickets
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => loadTickets()} className="rounded-lg bg-brand-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-brand-primary-hover">
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFilters({
                          department: '',
                          date_from: '',
                          date_to: '',
                          rating_min: '',
                          rating_max: '',
                          location: '',
                          risk_level: '',
                          payment_status: '',
                          include_archived: false,
                          pub_status: '',
                          audience: '',
                          featured_only: false,
                        })
                        setQuick('all')
                        setTypeFilter('all')
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-50"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3">
              {listLoading ? <TicketListSkeleton /> : null}
              {!listLoading && visibleItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-[#fff9ed]/50 p-8 text-center">
                  <MessagesSquare className="mx-auto size-8 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-700">No feedback in this view</p>
                  <p className="mt-1 text-xs text-gray-500">Try another type, tab, or search term.</p>
                </div>
              ) : null}

              <AnimatePresence mode="popLayout">
                {!listLoading
                  ? visibleItems.map((row, index) => {
                      const who = row?.full_name || row?.borrower?.name || row?.email || 'Unknown customer'
                      const letter = avatarText(row?.full_name || row?.borrower?.name, row?.email)
                      const typeId = resolveFeedbackType(row)
                      const typeMeta = FEEDBACK_TYPES[typeId] || FEEDBACK_TYPES.general
                      const status = statusMeta(row.status)
                      const pub = publicationMeta(row.publication_status, row.featured)
                      const isActive = selectedId === row.id

                      return (
                        <motion.button
                          key={row.id}
                          type="button"
                          layout
                          custom={index}
                          variants={listItemVariants}
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          onClick={() => setSelectedId(row.id)}
                          whileHover={{ y: -2, transition: { duration: 0.15 } }}
                          whileTap={{ scale: 0.99 }}
                          className={`group flex w-full flex-col rounded-2xl border-l-4 border bg-white p-3.5 text-left shadow-sm transition-all duration-200 ${
                            isActive
                              ? `${typeMeta.border} border-brand-primary/30 bg-gradient-to-r from-red-50/80 to-white ring-2 ring-brand-primary/20`
                              : `${typeMeta.border} border-gray-200/90 hover:border-gray-300 hover:shadow-md`
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${typeMeta.accent} text-xs font-bold text-white shadow-sm`}
                            >
                              {letter}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{row.subject || 'General Feedback'}</p>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${status.className}`}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="mt-1 line-clamp-1 text-xs font-medium text-gray-700">{who}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-500">{row.message || 'No message body'}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <FeedbackTypeBadge row={row} compact />
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${priorityMeta(row.priority).className}`}>
                              {row.priority || 'Medium'}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${pub.className}`}>{pub.label}</span>
                            {typeof row.rating === 'number' ? <StarRating value={row.rating} /> : null}
                            <span className="ml-auto shrink-0 text-[10px] font-medium tabular-nums text-gray-400">{formatTimestamp(row.created_at)}</span>
                          </div>
                        </motion.button>
                      )
                    })
                  : null}
              </AnimatePresence>
            </div>

            {pageMeta.last_page > 1 ? (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/80 px-4 py-3">
                <button
                  type="button"
                  disabled={listLoading || page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="size-3.5" />
                  Prev
                </button>
                <p className="text-center text-[11px] text-gray-600">
                  Page <span className="font-semibold text-gray-900">{pageMeta.current_page}</span> of{' '}
                  <span className="font-semibold text-gray-900">{pageMeta.last_page}</span>
                </p>
                <button
                  type="button"
                  disabled={listLoading || page >= pageMeta.last_page}
                  onClick={() => setPage((p) => Math.min(pageMeta.last_page, p + 1))}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        </section>

        {/* —— Workspace: detail + actions —— */}
        <div className="flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-lg ring-1 ring-black/[0.04] xl:max-h-[calc(100dvh-8.5rem)]">
          {!selectedId ? (
            <div className="grid flex-1 place-items-center bg-[#fff9ed]/30 p-8 text-center">
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <MessagesSquare className="mx-auto size-10 text-brand-primary/40" />
                <p className="mt-4 text-base font-semibold text-gray-800">Select feedback to review</p>
                <p className="mt-1 max-w-sm text-sm text-gray-500">Pick an item from the inbox to read the message and manage publication.</p>
              </motion.div>
            </div>
          ) : detailLoading ? (
            <div className="flex-1 space-y-4 p-6">
              <div className="h-7 w-[55%] animate-pulse rounded-lg bg-gray-200" />
              <div className="h-4 w-[38%] animate-pulse rounded-lg bg-gray-100" />
              <div className="h-44 animate-pulse rounded-2xl bg-gray-100" />
              <p className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="size-4 animate-spin text-brand-primary" />
                Loading ticket details…
              </p>
            </div>
          ) : !selected ? (
            <div className="grid flex-1 place-items-center p-8 text-center">
              <p className="text-sm font-semibold text-gray-800">Could not load this ticket</p>
              <p className="mt-1 text-xs text-gray-500">Refresh the list or pick another item.</p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,22rem)] lg:grid-rows-1">
              {/* Detail column */}
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="flex min-h-0 min-w-0 flex-col overflow-y-auto border-b border-gray-100 lg:border-b-0 lg:border-r"
              >
                <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] px-5 py-5 text-white">
                  <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <FeedbackTypeBadge row={selected} onDark />
                        {selected.is_vip ? (
                          <span className="rounded-full bg-amber-300/90 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-950">VIP</span>
                        ) : null}
                        {selected.is_sensitive ? (
                          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase backdrop-blur-sm">Sensitive</span>
                        ) : null}
                      </div>
                      <h3 className="text-xl font-semibold tracking-tight">{selected.subject || 'General Feedback'}</h3>
                      <p className="text-sm font-medium text-white/90">{submitterName}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/75">
                        <span className="break-all">{customer?.email || selectedSummary?.email || 'No email'}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">{formatTimestamp(selected.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <div className="flex flex-wrap gap-2">
                        <HeaderMetaPill label={selected.priority || 'Medium'} />
                        <HeaderMetaPill label={selected.status || 'New'} />
                      </div>
                      {typeof selected.rating === 'number' ? (
                        <div className="rounded-xl bg-white/15 px-3 py-1.5 backdrop-blur-sm">
                          <StarRating value={selected.rating} size="lg" />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 p-5">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Publication snapshot</p>
                    <p className="mt-2 text-sm leading-relaxed text-gray-700">
                      <span className="font-semibold text-gray-900">{selected.customer_type_label || (selected.contact?.borrower_id ? 'Borrower' : 'Customer')}</span>
                      {' · '}
                      Homepage:{' '}
                      <span className={selected.public_site_live ? 'font-semibold text-emerald-700' : 'font-medium text-gray-600'}>
                        {selected.public_site_live ? 'Visible (synced)' : 'Not visible'}
                      </span>
                      {' · '}
                      Consent {selected.consent_public_display ? 'on' : 'off'}
                    </p>
                    {!selected.public_site_live && String(selected.publication_status || '').toLowerCase() === 'approved' ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                        <p className="font-semibold">Approved but hidden from homepage</p>
                        {Array.isArray(selected.homepage_blockers) && selected.homepage_blockers.length > 0 ? (
                          <ul className="mt-1.5 list-disc space-y-1 pl-4">
                            {selected.homepage_blockers.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-[#fff9ed]/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">Source & product</p>
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                        {(selected.source === 'chatbot' || String(selected.source || '').toLowerCase().includes('chat')) && <Bot className="size-3" />}
                        {selected.source || 'unknown'}
                      </span>
                    </div>
                    {loan?.loan_product_applied ? (
                      <p className="mt-2 text-sm text-gray-600">
                        Product: <span className="font-medium text-gray-900">{loan.loan_product_applied}</span>
                      </p>
                    ) : null}
                    {selectedTypeMeta ? (
                      <p className="mt-2 text-xs leading-relaxed text-gray-600">{selectedTypeMeta.description}</p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                      <Sparkles className="size-3.5 text-brand-primary" />
                      Customer message
                    </p>
                    <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800">
                      {selected.message || 'No message body'}
                    </div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">Edit message (optional)</p>
                    <textarea
                      key={`msg-main-${selectedId}`}
                      rows={4}
                      defaultValue={selected.message || ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        const prev = String(selected.message || '').trim()
                        if (v === prev) return
                        onPatchTicket({ message: v })
                      }}
                      disabled={busy}
                      className="min-h-[96px] w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm leading-relaxed text-gray-800 outline-none transition focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 disabled:opacity-60"
                    />
                  </div>
                </div>
              </motion.div>

              {/* Actions column */}
              <aside className="flex min-h-0 flex-col overflow-y-auto bg-[#fff9ed]/20">
              <div className="border-b border-gray-100 bg-gradient-to-r from-[#fff9ed] to-white px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-primary">Actions</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onSetStatus('Archived')}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                  >
                    <Archive className="size-4" />
                    Archive
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={openDeleteModal}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-brand-primary transition hover:bg-red-100 disabled:opacity-60"
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </button>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="rounded-2xl border border-dashed border-brand-primary/25 bg-gradient-to-b from-red-50/50 to-white p-4">
                  <div className="flex items-start gap-2">
                    <Globe className="mt-0.5 size-4 shrink-0 text-brand-primary" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Public website testimonials</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-600">
                        Approved items with consent appear on the homepage (max 3 featured).{' '}
                        <span className="font-semibold tabular-nums text-brand-primary">
                          {featuredSlots.used}/{featuredSlots.max}
                        </span>{' '}
                        featured slots used.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 transition hover:border-brand-primary/20">
                      <input
                        type="checkbox"
                        checked={!!selected.consent_public_display}
                        disabled={busy}
                        onChange={(e) => onPatchTicket({ consent_public_display: e.target.checked })}
                        className="mt-0.5 size-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>Borrower consented to public display</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-800 transition hover:border-brand-primary/20">
                      <input
                        type="checkbox"
                        checked={!!selected.website_visible}
                        disabled={busy}
                        onChange={(e) => onPatchTicket({ website_visible: e.target.checked })}
                        className="mt-0.5 size-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                      />
                      <span>Legacy “show on website” flag</span>
                    </label>

                    <div>
                      <label htmlFor="public-author-label" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Public display name
                      </label>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Shown on the homepage — not the submitter name (
                        <span className="font-medium text-gray-700">{submitterName}</span>).
                      </p>
                      <input
                        id="public-author-label"
                        key={`pub-label-${selectedId}`}
                        ref={publicAuthorLabelRef}
                        type="text"
                        defaultValue={selected.public_author_label || ''}
                        placeholder="e.g. Maria S. or Verified Customer"
                        disabled={busy}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          const prev = String(selected.public_author_label || '').trim()
                          if (v === prev) return
                          onPatchTicket({ public_author_label: v || null })
                        }}
                        className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label htmlFor="loan-type-label" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                        Loan type label
                      </label>
                      <input
                        id="loan-type-label"
                        key={`loan-type-${selectedId}`}
                        type="text"
                        defaultValue={selected.loan_type || ''}
                        placeholder="e.g. Salary loan, Personal loan"
                        disabled={busy}
                        onBlur={(e) => {
                          const v = e.target.value.trim()
                          const prev = String(selected.loan_type || '').trim()
                          if (v === prev) return
                          onPatchTicket({ loan_type: v || null })
                        }}
                        className="mt-1.5 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-primary/40 focus:ring-2 focus:ring-brand-primary/15 disabled:opacity-60"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <motion.button
                        type="button"
                        disabled={busy}
                        whileHover={{ scale: busy ? 1 : 1.02 }}
                        whileTap={{ scale: busy ? 1 : 0.98 }}
                        onClick={() =>
                          onPublicationAction('/approve', {
                            consent_public_display: !!selected.consent_public_display,
                            featured: !!selected.featured,
                            public_author_label: resolveApprovePublicLabel(selected, publicAuthorLabelRef.current?.value),
                          })
                        }
                        className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-brand-primary text-sm font-semibold text-white shadow-md shadow-brand-primary/20 transition hover:bg-brand-primary-hover disabled:opacity-60"
                      >
                        <CheckCircle2 className="size-4" />
                        Approve
                      </motion.button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPublicationAction('/reject', {})}
                        className="h-10 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-brand-primary transition hover:bg-red-100 disabled:opacity-60"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={
                          busy ||
                          String(selected.publication_status || '').toLowerCase() !== 'approved' ||
                          (!selected.featured && featuredSlots.used >= featuredSlots.max)
                        }
                        onClick={() => onPublicationAction('/feature', {})}
                        className="h-10 rounded-xl border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                      >
                        Feature
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPublicationAction('/unfeature', {})}
                        className="h-10 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-60"
                      >
                        Unfeature
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={busy || !!selected.verified_borrower}
                      onClick={() => onPublicationAction('/verify-borrower', {})}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-brand-primary/25 bg-red-50 text-sm font-semibold text-brand-primary transition hover:bg-red-100 disabled:opacity-60"
                    >
                      {selected.verified_borrower ? (
                        <>
                          <CheckCircle2 className="size-4" />
                          Verified borrower
                        </>
                      ) : (
                        'Mark verified borrower'
                      )}
                    </button>
                  </div>
                </div>
              </div>
              </aside>
            </div>
          )}
        </div>

        {error ? (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full text-sm font-medium text-brand-primary">
            {error}
          </motion.p>
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
