import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { adminSocketUrls, chatFetch, chatJson, getLendingChatSecret, hasChatServerAuth } from '../utils/adminChatApi.js'
import { api as adminApi, getToken as getAdminToken } from '../admin/api/client.js'
import { downloadCsv } from '../admin/utils/export.js'

const STATUS_BADGE = {
  open: 'bg-amber-500/15 text-[color:var(--admin-warn-text)] ring-1 ring-amber-500/25',
  in_progress: 'bg-red-50 text-red-900 ring-1 ring-red-200',
  resolved: 'bg-emerald-500/15 text-[color:var(--admin-success-text)] ring-1 ring-emerald-500/25',
  archived: 'bg-slate-500/15 text-[color:var(--admin-neutral-text)] ring-1 ring-slate-500/20',
}
const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  archived: 'Archived',
}
/** Inbox lifecycle segments (archived threads remain visible under All). */
const FILTERS = ['all', 'open', 'in_progress', 'resolved']
const FILTER_LABEL = {
  all: 'All',
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  archived: 'Archived',
}
/** Laravel `/admin/chat/conversations` warehouse buckets (`bucket` query param). */
const VISITOR_QUEUE_BUCKETS = [
  { id: 'all', label: 'All queues' },
  { id: 'new', label: 'Needs attention' },
  { id: 'pending_response', label: 'Pending reply' },
  { id: 'escalated', label: 'Escalated' },
  { id: 'ai_handled', label: 'AI handled' },
  { id: 'human_handled', label: 'Staff' },
  { id: 'feedback_only', label: 'Has feedback' },
]

function CrmNavIcon({ name }) {
  const common = 'h-5 w-5 shrink-0'
  switch (name) {
    case 'inbox':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 001.664-.736l1.293-1.293A2.25 2.25 0 0112 10.5h.008a2.25 2.25 0 011.647.736l1.293 1.293c.412.422 1.07.736 1.664.736H22M4.5 19.5h15M8.25 9V6.75A2.25 2.25 0 0110.5 4.5h3a2.25 2.25 0 012.25 2.25V9" />
        </svg>
      )
    case 'leads':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      )
    case 'tickets':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25m16.5 0V6A2.25 2.25 0 0018 3.75H8.25A2.25 2.25 0 006 6v12" />
        </svg>
      )
    case 'analytics':
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    default:
      return null
  }
}

const LEAD_STATUS = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost: 'Lost',
}
const TICKET_PRIORITY = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
}
const TICKET_STATUS = {
  open: 'Open',
  pending: 'Pending',
  closed: 'Closed',
}
const CHAT_TIME_ZONE = 'Asia/Manila'
const CHAT_POLL_MS = 8000

function responseTimeTextClass(ms) {
  if (ms == null || Number.isNaN(Number(ms))) return 'text-slate-500'
  const n = Number(ms)
  if (n < 800) return 'text-emerald-600'
  if (n <= 2000) return 'text-amber-600'
  return 'text-red-600'
}

/**
 * CRM session indicator: green = visitor online + AI mode, yellow = AI mode but visitor offline, red = human mode.
 * @param {{ id: string, mode?: string }} c
 * @param {Record<string, boolean>} presenceMap
 */
function visitorAiConnectionDot(c, presenceMap) {
  if (c.mode === 'human') {
    return { title: 'Human agent (handoff)', className: 'bg-red-500' }
  }
  if (presenceMap[c.id]) {
    return { title: 'Visitor online — realtime AI connected', className: 'bg-emerald-500' }
  }
  return {
    title: 'Visitor not connected — they should wait for green on their screen before sending',
    className: 'bg-amber-400',
  }
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-pink-500',
]

function getAvatarColor(id) {
  let hash = 0
  for (let i = 0; i < (id || '').length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name) {
  if (name && name !== 'Visitor') {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    const a = parts[0]
    if (!a) return 'V'
    return parts.length > 1 && parts[1]
      ? (a[0] + parts[1][0]).toUpperCase()
      : a[0].toUpperCase()
  }
  return 'V'
}

function fmtTime(d) {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: CHAT_TIME_ZONE })
}

function fmtDate(d) {
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${fmtTime(d)}`
}

function messageKey(msg) {
  const idStr = msg?.id != null && msg.id !== '' ? String(msg.id) : ''
  const volatilePrefix =
    idStr.startsWith('tmp-') ||
    idStr.startsWith('t-') ||
    idStr.startsWith('stream-') ||
    idStr.startsWith('laravel-')
  if (idStr && !volatilePrefix && /^\d+$/.test(idStr)) {
    return `id:${idStr}`
  }
  const sid = msg?.conversation_id || msg?.session_id || ''
  const body = String(msg?.content ?? msg?.message ?? '').slice(0, 240)
  return `fp:${sid}|${String(msg?.sender || '')}|${body}|${String(msg?.created_at || '')}`
}

function mergeMessageRows(prev, incoming) {
  const all = [...(prev || []), ...(incoming || [])]
  const byKey = new Map()
  all.forEach((m) => byKey.set(messageKey(m), m))
  return Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a?.created_at || 0).getTime()
    const tb = new Date(b?.created_at || 0).getTime()
    if (ta !== tb) return ta - tb
    return String(a?.id || '').localeCompare(String(b?.id || ''))
  })
}

/** Short human-friendly ref for long conversation IDs (avoid full UUID in lists). */
function shortConversationRef(id) {
  if (id == null || id === '') return ''
  const s = String(id).replace(/^lending-/, '')
  if (s.length <= 10) return s
  return `…${s.slice(-8)}`
}

function conversationListSubtitle(c) {
  const email = (c.visitor_email || '').trim()
  if (email) return email
  const ref = shortConversationRef(c.id)
  return ref ? `Guest · ${ref}` : 'Guest visitor'
}

function normalizeLead(lead) {
  return {
    ...lead,
    user_id: lead.user_id ?? null,
    phone: lead.phone || '',
    company: lead.company || lead.organization || '',
    inquiry_message: lead.inquiry_message || lead.initial_message || '',
    source_page: lead.source_page || 'Contact form',
    status: lead.status || 'new',
  }
}

const VALID_VIEWS = ['chats', 'leads', 'analytics', 'tickets']

/** Left rail + column header title per view */
const VIEW_TITLE = {
  chats: 'Inbox',
  leads: 'Leads',
  analytics: 'Analytics',
  tickets: 'Tickets',
}

/** Matches `BorrowerPortalController::resolveBorrowerLead` — borrower portal chat threads. */
const BORROWER_CHAT_LOAN_TYPE = 'Borrower Support'

/** FAQ / auto-reply shortcuts (insert into composer; AI pipeline is on Node). */
const FAQ_QUICK_REPLIES = [
  'Hello! How can we help with your loan today?',
  'Thanks for reaching out — a specialist will review your application shortly.',
  'You can check your application status with your reference number.',
  'Our business hours are Monday–Friday, 9:00 AM–5:00 PM.',
]

export default function AdminChatDashboard({
  canViewAnalytics = true,
  canManageLoans = false,
  canViewBorrowers = false,
  canAssignStaff = false,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [filter, setFilter] = useState('all')
  const [chatReadFilter, setChatReadFilter] = useState('all')
  const [chatSelected, setChatSelected] = useState({})
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([])
  const [activeConvo, setActiveConvo] = useState(null)
  const [input, setInput] = useState('')
  /** Closed by default on mobile so the main pane is visible; `lg:` CSS keeps sidebar open on desktop. */
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [statusDropdown, setStatusDropdown] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [view, setView] = useState(() => {
    const v = searchParams.get('view')
    return VALID_VIEWS.includes(v) ? v : 'chats'
  })
  const [feedbackList, setFeedbackList] = useState([])
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackReadFilter, setFeedbackReadFilter] = useState('all')
  const [feedbackSelected, setFeedbackSelected] = useState({})
  const [deleteFeedbackTarget, setDeleteFeedbackTarget] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [leads, setLeads] = useState([])
  const [leadsFilter, setLeadsFilter] = useState('')
  const [leadsSearch, setLeadsSearch] = useState('')
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState(null)
  const [warehouseAnalytics, setWarehouseAnalytics] = useState(null)
  const [tickets, setTickets] = useState([])
  const [ticketReadFilter, setTicketReadFilter] = useState('all')
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all')
  const [ticketSelected, setTicketSelected] = useState({})
  const [ticketModal, setTicketModal] = useState(null)
  const [newLeadAlert, setNewLeadAlert] = useState(null)
  const [leadEmailModal, setLeadEmailModal] = useState(null)
  const [leadEmailSubject, setLeadEmailSubject] = useState('')
  const [leadEmailBody, setLeadEmailBody] = useState('')
  const [leadEmailSending, setLeadEmailSending] = useState(false)
  const [leadEmailError, setLeadEmailError] = useState('')
  const [convoSearch, setConvoSearch] = useState('')
  const [visitorQueueBucket, setVisitorQueueBucket] = useState('all')
  const [crmProfileOpen, setCrmProfileOpen] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [internalNotes, setInternalNotes] = useState('')
  const [socketConnected, setSocketConnected] = useState(false)
  const [socketConnectError, setSocketConnectError] = useState(null)
  const [visitorPresenceMap, setVisitorPresenceMap] = useState({})
  const [aiSessionMetrics, setAiSessionMetrics] = useState(null)
  /** Chats view: Node widget visitors vs Laravel borrower portal (same DB as /admin/leads messages). */
  const [chatInboxTab, setChatInboxTab] = useState('visitor')
  const [borrowerLeads, setBorrowerLeads] = useState([])
  const [activeBorrowerLeadId, setActiveBorrowerLeadId] = useState(null)
  const [borrowerMessages, setBorrowerMessages] = useState([])
  const [borrowerInboxSearch, setBorrowerInboxSearch] = useState('')
  const [borrowerInput, setBorrowerInput] = useState('')
  const [borrowerSending, setBorrowerSending] = useState(false)
  /** Laravel staff list for `/warehouse-assign` (requires `users.view`). */
  const [assignStaffRows, setAssignStaffRows] = useState([])
  const [warehouseActionError, setWarehouseActionError] = useState('')
  const [conversationWarehouseBusy, setConversationWarehouseBusy] = useState(false)
  const socketRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeout = useRef(null)
  const prevActiveId = useRef(null)
  const fetchLeadsRef = useRef(() => {})
  const fetchConversationsRef = useRef(async () => {})
  const fetchTicketsRef = useRef(async () => {})
  const fetchAnalyticsRef = useRef(async () => {})
  const fetchFeedbackRef = useRef(async () => {})
  const fetchAiSessionMetricsRef = useRef(async () => {})
  const activeIdRef = useRef(null)
  const latestMessageIdByConversationRef = useRef(new Map())
  const messagesRequestSeqRef = useRef(0)
  const conversationsRequestSeqRef = useRef(0)
  const fetchMessagesRef = useRef(async () => {})
  const fetchBorrowerMessagesRef = useRef(async () => {})
  const fetchBorrowerLeadsRef = useRef(async () => {})
  const viewRef = useRef(null)
  const chatInboxTabRef = useRef(null)
  const activeBorrowerLeadIdRef = useRef(null)

  const fetchConversations = useCallback(async () => {
    const requestSeq = ++conversationsRequestSeqRef.current
    try {
      const params = new URLSearchParams({ limit: '250' })
      if (visitorQueueBucket && visitorQueueBucket !== 'all') {
        params.set('bucket', visitorQueueBucket)
      } else if (filter && filter !== 'all') {
        params.set('status', filter)
      }
      const data = await adminApi(`/admin/chat/conversations?${params}`)
      if (requestSeq !== conversationsRequestSeqRef.current) return
      setConversations(Array.isArray(data) ? data : [])
    } catch {
      if (requestSeq === conversationsRequestSeqRef.current) setConversations([])
    }
  }, [visitorQueueBucket, filter])

  const fetchMessages = useCallback(async (id, options = {}) => {
    if (!id) return
    const afterId = Math.max(Number(options?.afterId) || 0, 0)
    const requestSeq = ++messagesRequestSeqRef.current
    try {
      const q = new URLSearchParams()
      if (afterId > 0) q.set('after_id', String(afterId))
      q.set('limit', afterId > 0 ? '120' : '200')
      const data = await adminApi(`/admin/chat/conversations/${encodeURIComponent(id)}/messages?${q}`)
      if (requestSeq !== messagesRequestSeqRef.current) return
      const rows = Array.isArray(data) ? data : []
      if (!rows.length) return
      setMessages((prev) => (afterId > 0 ? mergeMessageRows(prev, rows) : rows))
      const maxId = rows.reduce((acc, row) => Math.max(acc, Number(row?.id) || 0), 0)
      if (maxId > 0) latestMessageIdByConversationRef.current.set(id, maxId)
    } catch {
      if (requestSeq === messagesRequestSeqRef.current && afterId === 0) setMessages([])
    }
  }, [])

  useEffect(() => {
    fetchMessagesRef.current = fetchMessages
  }, [fetchMessages])

  const fetchBorrowerLeads = useCallback(async () => {
    try {
      const q = new URLSearchParams({
        loan_type: BORROWER_CHAT_LOAN_TYPE,
        per_page: '100',
      })
      const res = await adminApi(`/admin/leads?${q}`)
      setBorrowerLeads((res?.data?.data || []).map(normalizeLead))
    } catch {
      /* ignore */
    }
  }, [])

  const fetchBorrowerMessages = useCallback(async (leadId) => {
    if (!leadId) return
    try {
      const res = await adminApi(`/admin/leads/${leadId}/messages`)
      setBorrowerMessages(Array.isArray(res?.data) ? res.data : [])
    } catch {
      setBorrowerMessages([])
    }
  }, [])

  const sendBorrowerReply = useCallback(async () => {
    const text = borrowerInput.trim()
    if (!text || !activeBorrowerLeadId) return
    setBorrowerSending(true)
    try {
      const fd = new FormData()
      fd.append('message', text)
      await adminApi(`/admin/leads/${activeBorrowerLeadId}/messages`, { method: 'POST', body: fd })
      setBorrowerInput('')
      await fetchBorrowerMessages(activeBorrowerLeadId)
      await fetchBorrowerLeads()
    } catch (e) {
      console.error(e)
    } finally {
      setBorrowerSending(false)
    }
  }, [borrowerInput, activeBorrowerLeadId, fetchBorrowerMessages, fetchBorrowerLeads])

  useEffect(() => {
    fetchBorrowerMessagesRef.current = fetchBorrowerMessages
  }, [fetchBorrowerMessages])

  useEffect(() => {
    fetchBorrowerLeadsRef.current = fetchBorrowerLeads
  }, [fetchBorrowerLeads])

  useEffect(() => {
    viewRef.current = view
  }, [view])

  useEffect(() => {
    chatInboxTabRef.current = chatInboxTab
  }, [chatInboxTab])

  useEffect(() => {
    activeBorrowerLeadIdRef.current = activeBorrowerLeadId
  }, [activeBorrowerLeadId])

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true)
    try {
      const { res } = await chatFetch('/api/admin/feedback')
      if (!res || res.status === 401 || res.status === 403) {
        setFeedbackList([])
        return
      }
      const data = await res.json().catch(() => [])
      setFeedbackList(Array.isArray(data) ? data : [])
    } catch {
      setFeedbackList([])
    } finally {
      setFeedbackLoading(false)
    }
  }, [])

  const fetchLeads = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (leadsFilter) params.set('status', leadsFilter)
      if (leadsSearch) params.set('search', leadsSearch)
      const { res } = await chatFetch(`/api/admin/leads?${params}`)
      if (res?.status === 401 || res?.status === 403) return
      const data = await res?.json?.().catch(() => [])
      setLeads((Array.isArray(data) ? data : []).map(normalizeLead))
    } catch {
      /* ignore */
    }
  }, [leadsFilter, leadsSearch])

  /* analyticsError / setAnalyticsError: declared once with other useState hooks above (do not redeclare here). */
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const aq = new URLSearchParams({ since: '-7 days' })
      const { res } = await chatFetch(`/api/admin/analytics?${aq}`)
      if (!res || res.status === 401) {
        return
      }
      const data = await res.json().catch(() => ({}))
      if (res.ok && data && typeof data.visits === 'number') {
        setAnalytics(data)
      } else {
        setAnalyticsError(data?.message || 'Could not load analytics from database.')
        setAnalytics((prev) => prev || null)
      }
    } catch {
      setAnalyticsError('Network error — is the API running?')
      setAnalytics((prev) => prev || null)
    }
    try {
      const wh = await adminApi('/admin/chat/support-analytics?days=30')
      if (wh?.ok && wh.totals) setWarehouseAnalytics(wh)
      else setWarehouseAnalytics(null)
    } catch {
      setWarehouseAnalytics(null)
    }
    setAnalyticsLoading(false)
  }, [])

  const fetchTickets = useCallback(async () => {
    try {
      const { res } = await chatFetch('/api/admin/tickets')
      if (!res || res.status === 401) {
        return
      }
      setTickets(await res.json())
    } catch {
      /* ignore */
    }
  }, [])

  const fetchAiSessionMetrics = useCallback(async () => {
    try {
      const { res, data } = await chatJson('/api/admin/ai-session-metrics')
      if (!res?.ok || !data) return
      setAiSessionMetrics(data)
      if (data.visitorOnlineByConversation && typeof data.visitorOnlineByConversation === 'object') {
        setVisitorPresenceMap(data.visitorOnlineByConversation)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchLeadsRef.current = fetchLeads
    fetchConversationsRef.current = fetchConversations
    fetchTicketsRef.current = fetchTickets
    fetchAnalyticsRef.current = fetchAnalytics
    fetchFeedbackRef.current = fetchFeedback
    fetchAiSessionMetricsRef.current = fetchAiSessionMetrics
  }, [fetchLeads, fetchConversations, fetchTickets, fetchAnalytics, fetchFeedback, fetchAiSessionMetrics])

  useEffect(() => {
    if (view !== 'chats' || chatInboxTab !== 'visitor') return
    fetchAiSessionMetrics()
  }, [view, chatInboxTab, fetchAiSessionMetrics])

  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  useEffect(() => {
    if (view !== 'chats') return
    if (chatInboxTab === 'borrower') {
      setActiveId(null)
      setMessages([])
      setActiveConvo(null)
      fetchBorrowerLeads()
    } else {
      setActiveBorrowerLeadId(null)
      setBorrowerMessages([])
      fetchConversations()
    }
  }, [chatInboxTab, view, fetchBorrowerLeads, fetchConversations])

  useEffect(() => {
    if (view !== 'chats' || chatInboxTab !== 'borrower' || !activeBorrowerLeadId) return
    if (socketConnected) return
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      fetchBorrowerMessages(activeBorrowerLeadId)
    }
    tick()
    const iv = setInterval(tick, CHAT_POLL_MS)
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [view, chatInboxTab, activeBorrowerLeadId, fetchBorrowerMessages, socketConnected])

  useEffect(() => {
    if (view !== 'chats' || chatInboxTab !== 'visitor') return
    if (socketConnected) return
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      fetchConversations()
      if (activeIdRef.current) {
        const afterId = Number(latestMessageIdByConversationRef.current.get(activeIdRef.current) || 0)
        fetchMessages(activeIdRef.current, { afterId: afterId > 0 ? afterId : 0 })
      }
    }
    tick()
    const iv = setInterval(tick, CHAT_POLL_MS)
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [view, chatInboxTab, activeId, fetchConversations, fetchMessages, socketConnected])

  useEffect(() => {
    if (view !== 'chats' || chatInboxTab !== 'borrower') return
    if (activeBorrowerLeadId) return
    if (borrowerLeads.length) setActiveBorrowerLeadId(borrowerLeads[0].id)
  }, [view, chatInboxTab, borrowerLeads, activeBorrowerLeadId])

  const bulkAction = async (resource, action, ids) => {
    if (!ids?.length) return
    if (resource === 'conversations') {
      try {
        for (const rawId of ids) {
          const enc = encodeURIComponent(rawId)
          if (action === 'delete') {
            await adminApi(`/admin/chat/conversations/${enc}/warehouse`, { method: 'DELETE' })
          } else if (action === 'markRead') {
            await adminApi(`/admin/chat/conversations/${enc}/warehouse-status`, {
              method: 'PATCH',
              body: JSON.stringify({ unread_admin: 0 }),
            })
          } else if (action === 'markUnread') {
            await adminApi(`/admin/chat/conversations/${enc}/warehouse-status`, {
              method: 'PATCH',
              body: JSON.stringify({ unread_admin: 1 }),
            })
          }
        }
        setChatSelected({})
        fetchConversations()
      } catch {
        /* ignore */
      }
      return
    }
    const { res } = await chatFetch('/api/admin/bulk', {
      method: 'POST',
      body: JSON.stringify({ resource, action, ids }),
    })
    if (!res.ok) return
    if (resource === 'feedback') {
      setFeedbackSelected({})
      fetchFeedback()
      if (action === 'markRead' || action === 'markUnread' || action === 'delete') {
        window.dispatchEvent(new CustomEvent('admin:statsRefresh'))
      }
    }
    if (resource === 'tickets') {
      setTicketSelected({})
      fetchTickets()
    }
  }

  useEffect(() => {
    fetchConversations()
    fetchLeads()
    fetchFeedback()
    fetchTickets()
  }, [fetchConversations, fetchLeads, fetchFeedback, fetchTickets])

  useEffect(() => {
    setWarehouseActionError('')
    if (!activeId) {
      setInternalNotes('')
      return
    }
    try {
      setInternalNotes(localStorage.getItem(`al_crm_notes_${activeId}`) || '')
    } catch {
      setInternalNotes('')
    }
  }, [activeId])

  const persistInternalNotes = useCallback(
    (next) => {
      setInternalNotes(next)
      if (activeId) {
        try {
          localStorage.setItem(`al_crm_notes_${activeId}`, next)
        } catch {
          /* ignore */
        }
      }
    },
    [activeId],
  )

  useEffect(() => {
    if (view === 'leads') fetchLeads()
  }, [view, leadsFilter, leadsSearch, fetchLeads])

  useEffect(() => {
    if (view === 'analytics') fetchAnalytics()
  }, [view, fetchAnalytics])

  useEffect(() => {
    if (view !== 'analytics') return
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      fetchAnalytics()
    }
    const id = setInterval(tick, 15000)
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick()
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis)
    }
  }, [view, fetchAnalytics])

  useEffect(() => {
    if (view === 'tickets') fetchTickets()
  }, [view, fetchTickets])

  useEffect(() => {
    if (view === 'chats') return
    if (prevActiveId.current) {
      socketRef.current?.emit('admin:leaveConversation', prevActiveId.current)
      prevActiveId.current = null
    }
    setActiveId(null)
    setActiveConvo(null)
    setMessages([])
    setInput('')
    setStatusDropdown(false)
  }, [view])

  useEffect(() => {
    let disposed = false
    let currentSocket = null
    const targets = adminSocketUrls()

    const attachHandlers = (socket) => {
      socket.on('visitor:presence', ({ conversationId, online }) => {
        const id = String(conversationId || '').trim()
        if (!id) return
        setVisitorPresenceMap((prev) => {
          const next = { ...prev }
          if (online) next[id] = true
          else delete next[id]
          return next
        })
      })
      socket.on('ai:metrics:refresh', () => {
        fetchAiSessionMetricsRef.current()
      })
      socket.on('conversations:refresh', () => fetchConversationsRef.current())
      socket.on('conversation:updated', (convo) => {
        if (!convo?.id) return
        setConversations((prev) =>
          prev.map((c) => (c.id === convo.id ? { ...c, ...convo } : c)),
        )
        if (activeIdRef.current === convo.id) setActiveConvo((c) => (c ? { ...c, ...convo } : c))
      })
      socket.on('conversation:modeChanged', ({ conversationId: cid, mode }) => {
        if (!cid) return
        setActiveConvo((c) => (c?.id === cid && c ? { ...c, mode } : c))
        setConversations((prev) =>
          prev.map((c) => (c.id === cid ? { ...c, mode } : c)),
        )
      })
      socket.on('tickets:refresh', () => fetchTicketsRef.current())
      socket.on('analytics:refresh', () => fetchAnalyticsRef.current())
      socket.on('feedback:refresh', () => fetchFeedbackRef.current())
      socket.on('leads:refresh', () => fetchLeadsRef.current())
      socket.on('admin:newLead', (lead) => {
        setNewLeadAlert(lead)
        fetchLeadsRef.current()
        setTimeout(() => setNewLeadAlert(null), 6000)
      })
      socket.on('chat:message', (msg) => {
        const msgConvoId = String(msg?.conversation_id || msg?.session_id || '').trim()
        const msgId = Number(msg?.id || 0)
        if (msgConvoId && msgId > 0) {
          const prevMax = Number(latestMessageIdByConversationRef.current.get(msgConvoId) || 0)
          if (msgId > prevMax) latestMessageIdByConversationRef.current.set(msgConvoId, msgId)
        }
        const active = String(activeIdRef.current || '')
        const relates =
          (msg?.conversation_id && String(msg.conversation_id) === active) ||
          (msg?.session_id && String(msg.session_id) === active)
        setMessages((prev) => (relates ? mergeMessageRows(prev, [msg]) : prev))
      })
      socket.on('chat:newMessage', ({ conversationId, message }) => {
        const cid = String(conversationId || '')
        const msgId = Number(message?.id || 0)
        if (cid && msgId > 0) {
          const prevMax = Number(latestMessageIdByConversationRef.current.get(cid) || 0)
          if (msgId > prevMax) latestMessageIdByConversationRef.current.set(cid, msgId)
        }
        const active = String(activeIdRef.current || '')
        if (cid === active && message) {
          const normalized = {
            id: message.id || `t-${Date.now()}`,
            sender: message.sender,
            content: message.content,
            created_at: message.created_at,
            admin_name: message.admin_name,
          }
          setMessages((prev) => mergeMessageRows(prev, [normalized]))
        }
        if (!cid) return
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c.id === cid)
          if (idx < 0) {
            // New thread reached the inbox through socket before current list snapshot.
            // Re-fetch so the sidebar updates immediately without manual page reload.
            fetchConversationsRef.current?.()
            return prev
          }
          const current = prev[idx]
          const nextRow = {
            ...current,
            last_message: message
              ? {
                  id: message.id || current?.last_message?.id,
                  content: message.content ?? current?.last_message?.content ?? '',
                  sender: message.sender ?? current?.last_message?.sender ?? 'user',
                  created_at: message.created_at || new Date().toISOString(),
                  admin_name: message.admin_name ?? current?.last_message?.admin_name ?? null,
                }
              : current.last_message,
            last_message_at: message?.created_at || current.last_message_at,
            updated_at: message?.created_at || current.updated_at,
            unread_count:
              cid !== active
                ? Math.max(0, Number(current?.unread_count || 0) + 1)
                : 0,
            admin_unread_count:
              cid !== active
                ? Math.max(
                    0,
                    Number(current?.admin_unread_count ?? current?.unread_count ?? 0) + 1,
                  )
                : 0,
          }
          const next = prev.slice()
          next[idx] = nextRow
          return next
        })
      })
      socket.on('chat:streamStart', ({ conversation_id: cid, stream_id: streamId, created_at }) => {
        if (!cid || !streamId || cid !== activeIdRef.current) return
        setMessages((prev) => [
          ...prev,
          {
            id: `stream-${streamId}`,
            sender: 'ai',
            content: '',
            created_at: created_at || new Date().toISOString(),
          },
        ])
      })
      socket.on('chat:streamDelta', ({ conversation_id: cid, stream_id: streamId, delta }) => {
        if (!cid || !streamId || cid !== activeIdRef.current) return
        const chunk = String(delta || '')
        if (!chunk) return
        const messageId = `stream-${streamId}`
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: `${m.content || ''}${chunk}` } : m)),
        )
      })
      socket.on('chat:streamEnd', ({ conversation_id: cid, stream_id: streamId, content, created_at }) => {
        if (!cid || !streamId || cid !== activeIdRef.current) return
        const messageId = `stream-${streamId}`
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  sender: 'ai',
                  content: String(content || m.content || ''),
                  created_at: created_at || m.created_at || new Date().toISOString(),
                }
              : m,
          ),
        )
      })
      socket.on('disconnect', () => setSocketConnected(false))
      socket.on('chat:error', (payload) => {
        const msg = String(payload?.message || '').trim()
        if (msg) setSocketConnectError(msg)
      })
    }

    const connectWithFallback = (index) => {
      if (disposed || index >= targets.length) return
      const target = targets[index]
      const socket = io(target, { transports: ['websocket', 'polling'] })
      currentSocket = socket
      socketRef.current = socket
      setSocketConnected(socket.connected)
      setSocketConnectError(null)

      attachHandlers(socket)
      socket.on('connect', () => {
        if (disposed) return
        setSocketConnected(true)
        setSocketConnectError(null)
        socket.emit('admin:join', {
          token: getAdminToken() || '',
          secret: getLendingChatSecret() || '',
        })
        queueMicrotask(() => {
          fetchConversationsRef.current?.().catch(() => {})
          const v = viewRef.current
          const tab = chatInboxTabRef.current
          const aid = activeIdRef.current
          if (v === 'chats' && tab === 'visitor' && aid) {
            const afterId = Number(latestMessageIdByConversationRef.current.get(aid) || 0)
            fetchMessagesRef.current?.(aid, {
              afterId: afterId > 0 ? afterId : 0,
            })
          }
          const bid = activeBorrowerLeadIdRef.current
          if (v === 'chats' && tab === 'borrower' && bid) {
            fetchBorrowerMessagesRef.current?.(bid)
          }
          if (tab === 'borrower') fetchBorrowerLeadsRef.current?.().catch(() => {})
        })
      })
      socket.on('connect_error', (err) => {
        if (disposed) return
        setSocketConnected(false)
        setSocketConnectError(err?.message || 'Cannot reach chat server.')
        socket.removeAllListeners()
        socket.disconnect()
        connectWithFallback(index + 1)
      })
    }

    connectWithFallback(0)
    return () => {
      disposed = true
      currentSocket?.removeAllListeners()
      currentSocket?.disconnect()
    }
  }, [])

  useEffect(() => {
    if (chatInboxTab !== 'visitor') return
    if (!activeId) return
    if (prevActiveId.current && prevActiveId.current !== activeId) {
      socketRef.current?.emit('admin:leaveConversation', prevActiveId.current)
    }
    socketRef.current?.emit('admin:joinConversation', activeId)
    prevActiveId.current = activeId
    const afterId = Number(latestMessageIdByConversationRef.current.get(activeId) || 0)
    fetchMessages(activeId, { afterId: afterId > 0 ? afterId : 0 })
    const convo = conversations.find((c) => c.id === activeId)
    setActiveConvo(convo || null)
  }, [activeId, fetchMessages, conversations, chatInboxTab])

  useEffect(() => {
    if (activeId) {
      const convo = conversations.find((c) => c.id === activeId)
      if (convo) setActiveConvo(convo)
    }
  }, [conversations, activeId])

  // Keep chat usable: auto-select the first conversation when none is selected.
  useEffect(() => {
    if (view !== 'chats') return
    if (chatInboxTab !== 'visitor') return
    if (activeId) return
    if (!conversations.length) return
    setActiveId(conversations[0].id)
  }, [view, chatInboxTab, activeId, conversations])

  useEffect(() => {
    const v = searchParams.get('view')
    if (VALID_VIEWS.includes(v)) {
      if (v === 'analytics' && !canViewAnalytics) {
        setView('chats')
        setSearchParams(
          (prev) => {
            const p = new URLSearchParams(prev)
            p.set('view', 'chats')
            return p
          },
          { replace: true },
        )
      } else {
        setView(v)
      }
    }
  }, [searchParams, canViewAnalytics, setSearchParams])

  /** Deep link from admin shell: /admin/chat-crm?view=chats&conversation=<id> (visitor message redirect). */
  useEffect(() => {
    const cid = searchParams.get('conversation')?.trim()
    if (!cid) return
    setView('chats')
    setChatInboxTab('visitor')
    setActiveId(cid)
    const next = new URLSearchParams(searchParams)
    next.delete('conversation')
    next.delete('inbox')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    })
  }, [messages])

  useEffect(() => {
    if (view !== 'chats' || chatInboxTab !== 'borrower') return
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    })
  }, [borrowerMessages, view, chatInboxTab])

  const goToView = useCallback(
    (v) => {
      setView(v)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('view', v)
          if (v !== 'chats') p.delete('inbox')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const switchChatInbox = useCallback(
    (tab) => {
      setChatInboxTab(tab)
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('view', 'chats')
          if (tab === 'borrower') p.set('inbox', 'borrower')
          else p.delete('inbox')
          return p
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  /** Admin shell Socket listener: jump to visitor thread without remounting the CRM route. */
  useEffect(() => {
    const onFocusRequest = (e) => {
      const cid = String(e?.detail?.conversationId || '').trim()
      if (!cid) return
      switchChatInbox('visitor')
      setActiveId(cid)
      fetchConversations()
      fetchMessages(cid, {})
    }
    window.addEventListener('admin:focusChatConversation', onFocusRequest)
    return () => window.removeEventListener('admin:focusChatConversation', onFocusRequest)
  }, [switchChatInbox, fetchConversations, fetchMessages])

  useEffect(() => {
    const v = searchParams.get('view')
    if (v !== 'chats') return
    const inbox = searchParams.get('inbox')
    setChatInboxTab(inbox === 'borrower' ? 'borrower' : 'visitor')
  }, [searchParams])

  const handleSend = () => {
    const text = input.trim()
    if (!text || !activeId) return
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimisticMessage = {
      id: tempId,
      sender: 'admin',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMessage])
    setInput('')
    adminApi(`/admin/chat/conversations/${encodeURIComponent(activeId)}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message: text }),
    })
      .then((res) => {
        const serverMessage = res?.message || null
        if (serverMessage) {
          const serverId = Number(serverMessage?.id || 0)
          if (serverId > 0) {
            latestMessageIdByConversationRef.current.set(
              activeId,
              Math.max(serverId, Number(latestMessageIdByConversationRef.current.get(activeId) || 0)),
            )
          }
          setMessages((prev) => prev.map((m) => (m.id === tempId ? serverMessage : m)))
        } else {
          const afterId = Number(latestMessageIdByConversationRef.current.get(activeId) || 0)
          fetchMessages(activeId, { afterId: afterId > 0 ? afterId : 0 })
        }
        const latest = serverMessage || optimisticMessage
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  last_message: latest,
                  last_message_at: latest.created_at,
                  updated_at: latest.created_at,
                  unread_count: 0,
                  admin_unread_count: 0,
                }
              : c,
          ),
        )
      })
      .catch(() => {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      })
    inputRef.current?.focus()
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (event) => {
    setInput(event.target.value)
    socketRef.current?.emit('admin:typing', { conversationId: activeId })
    clearTimeout(typingTimeout.current)
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('admin:typingStop', { conversationId: activeId })
    }, 1500)
  }

  const changeStatus = async (id, status) => {
    try {
      const enc = encodeURIComponent(id)
      await adminApi(`/admin/chat/conversations/${enc}/warehouse-status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      fetchConversations()
      if (id === activeId) {
        setActiveConvo((c) => (c ? { ...c, status } : c))
      }
    } catch (error) {
      console.error('Failed to change status:', error)
    }
    setStatusDropdown(false)
  }

  const toggleAIMode = async (id) => {
    const convo = conversations.find((c) => c.id === id) || activeConvo
    const nextMode = convo?.mode === 'ai' ? 'human' : 'ai'
    try {
      const enc = encodeURIComponent(id)
      await adminApi(`/admin/chat/conversations/${enc}/warehouse-status`, {
        method: 'PATCH',
        body: JSON.stringify({ mode: nextMode }),
      })
      fetchConversations()
      if (id === activeId) {
        setActiveConvo((c) => (c ? { ...c, mode: nextMode } : c))
      }
    } catch (error) {
      console.error('Failed to toggle AI:', error)
    }
  }

  useEffect(() => {
    if (!canAssignStaff || view !== 'chats') return undefined
    let cancelled = false
    ;(async () => {
      try {
        const res = await adminApi('/admin/users?per_page=150&is_active=true')
        const rows = Array.isArray(res?.data?.data) ? res.data.data : []
        const staffOnly = rows.filter((u) => u && String(u.role || '').toLowerCase() !== 'borrower')
        if (!cancelled) setAssignStaffRows(staffOnly)
      } catch {
        if (!cancelled) setAssignStaffRows([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canAssignStaff, view])

  const assignConversationToStaff = async (userIdRaw) => {
    if (!activeId) return
    const uid = Number(userIdRaw)
    if (!Number.isFinite(uid) || uid < 1) return
    setWarehouseActionError('')
    setConversationWarehouseBusy(true)
    try {
      await adminApi(`/admin/chat/conversations/${encodeURIComponent(activeId)}/warehouse-assign`, {
        method: 'POST',
        body: JSON.stringify({ user_id: uid }),
      })
      await fetchConversations()
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, assigned_to: uid } : c)),
      )
      setActiveConvo((c) => (c ? { ...c, assigned_to: uid } : c))
    } catch (e) {
      setWarehouseActionError(e?.message || 'Assignment failed.')
    } finally {
      setConversationWarehouseBusy(false)
    }
  }

  const patchConversationNeedsHuman = async (needsHuman) => {
    if (!activeId) return
    setWarehouseActionError('')
    setConversationWarehouseBusy(true)
    try {
      await adminApi(`/admin/chat/conversations/${encodeURIComponent(activeId)}/warehouse-status`, {
        method: 'PATCH',
        body: JSON.stringify({ needs_human: Boolean(needsHuman) }),
      })
      await fetchConversations()
      const next = Boolean(needsHuman)
      setActiveConvo((c) => (c ? { ...c, needs_human: next } : c))
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, needs_human: next } : c)),
      )
    } catch (e) {
      setWarehouseActionError(e?.message || 'Escalation update failed.')
    } finally {
      setConversationWarehouseBusy(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await adminApi(`/admin/chat/conversations/${encodeURIComponent(deleteTarget)}/warehouse`, {
        method: 'DELETE',
      })
      fetchConversations()
      if (deleteTarget === activeId) {
        setActiveId(null)
        setActiveConvo(null)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
    setDeleteTarget(null)
  }

  const handleDeleteFeedback = async () => {
    if (!deleteFeedbackTarget) return
    try {
      await chatFetch(`/api/admin/feedback/${deleteFeedbackTarget}`, {
        method: 'DELETE',
      })
      fetchFeedback()
    } catch (error) {
      console.error('Failed to delete feedback:', error)
    }
    setDeleteFeedbackTarget(null)
  }

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      if (view === 'chats' && chatInboxTab === 'borrower') await fetchBorrowerLeads()
      else if (view === 'chats') await fetchConversations()
      else if (view === 'feedback') await fetchFeedback()
      else if (view === 'leads') await fetchLeads()
      else if (view === 'analytics') await fetchAnalytics()
      else if (view === 'tickets') await fetchTickets()
    } finally {
      setTimeout(() => setRefreshing(false), 400)
    }
  }

  const exportLeadsCsv = async () => {
    try {
      downloadCsv(
        'leads.csv',
        ['Name', 'Email', 'Phone', 'Company', 'Inquiry', 'Source', 'Status', 'Created'],
        (leads || []).map((lead) => [
          lead.name || '',
          lead.email || '',
          lead.phone || '',
          lead.company || '',
          lead.inquiry_message || '',
          lead.source_page || '',
          lead.status || '',
          lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
        ]),
      )
    } catch (error) {
      console.error(error)
    }
  }

  const updateLeadStatusById = async (leadId, status) => {
    try {
      const lead = (leads || []).find((row) => String(row.id) === String(leadId))
      const { res } = await chatFetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res?.status === 401 || res?.status === 403) return

      if ((status === 'converted' || status === 'qualified') && lead?.conversation_id) {
        await adminApi(
          `/admin/chat/conversations/${encodeURIComponent(lead.conversation_id)}/warehouse-status`,
          {
            method: 'PATCH',
            body: JSON.stringify({ status: 'archived' }),
          },
        )
      }
      fetchLeads()
      fetchBorrowerLeads()
      fetchConversations()
    } catch (error) {
      console.error(error)
    }
  }

  const deleteLeadById = async (leadId) => {
    try {
      await adminApi(`/admin/leads/${leadId}`, {
        method: 'DELETE',
      })
      fetchLeads()
    } catch (error) {
      console.error(error)
    }
  }

  const openLeadEmailModal = (lead) => {
    setLeadEmailError('')
    setLeadEmailSubject('Re: Your inquiry — Amalgated Lending')
    setLeadEmailBody(
      `Hello ${lead.name || 'there'},\n\n\n\nKind regards,\nAmalgated Lending team`,
    )
    setLeadEmailModal(lead)
  }

  const sendLeadEmail = async () => {
    if (!leadEmailModal?.id) return
    const addr = String(leadEmailModal.email || '').trim()
    if (!addr) {
      setLeadEmailError('This lead has no email address.')
      return
    }
    setLeadEmailSending(true)
    setLeadEmailError('')
    try {
      await adminApi(`/admin/leads/${leadEmailModal.id}/email`, {
        method: 'POST',
        body: JSON.stringify({
          subject: leadEmailSubject.trim(),
          body: leadEmailBody,
          email: addr,
          name: leadEmailModal.name || '',
        }),
      })
      setLeadEmailModal(null)
    } catch (e) {
      setLeadEmailError(e.message || 'Failed to send email.')
    } finally {
      setLeadEmailSending(false)
    }
  }

  const createTicketForConvo = async (conversationId) => {
    try {
      await chatFetch('/api/admin/tickets', {
        method: 'POST',
        body: JSON.stringify({
          conversation_id: conversationId,
          priority: 'medium',
          status: 'open',
        }),
      })
      setTicketModal(null)
      goToView('tickets')
      fetchTickets()
    } catch (error) {
      console.error(error)
    }
  }

  const updateTicketById = async (ticketId, data) => {
    try {
      await chatFetch(`/api/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
      fetchTickets()
    } catch (error) {
      console.error(error)
    }
  }

  const filteredBase =
    visitorQueueBucket !== 'all'
      ? conversations
      : filter === 'all'
        ? conversations
        : conversations.filter((c) => c.status === filter)
  const filtered = filteredBase.filter((c) => {
    const unread = (c.admin_unread_count ?? c.unread_count ?? 0) > 0
    if (chatReadFilter === 'unread') return unread
    if (chatReadFilter === 'read') return !unread
    return true
  })

  const filteredFeedback = feedbackList.filter((f) => {
    if (feedbackReadFilter === 'unread') return !f.is_read
    if (feedbackReadFilter === 'read') return !!f.is_read
    return true
  })

  const filteredTickets = tickets.filter((t) => {
    if (ticketStatusFilter !== 'all' && t.status !== ticketStatusFilter) return false
    const unread = !!t.is_unread
    if (ticketReadFilter === 'unread') return unread
    if (ticketReadFilter === 'read') return !unread
    return true
  })

  const displayName = (c) => c.visitor_name || 'Visitor'

  const searchQ = convoSearch.trim().toLowerCase()
  const filteredList =
    view !== 'chats' || !searchQ
      ? filtered
      : filtered.filter(
          (c) =>
            displayName(c).toLowerCase().includes(searchQ) ||
            (c.id || '').toLowerCase().includes(searchQ) ||
            (c.visitor_email || '').toLowerCase().includes(searchQ),
        )

  const borrowerSq = borrowerInboxSearch.trim().toLowerCase()
  const filteredBorrowerLeads = !borrowerSq
    ? borrowerLeads
    : borrowerLeads.filter(
        (l) =>
          (l.name || '').toLowerCase().includes(borrowerSq) ||
          (l.email || '').toLowerCase().includes(borrowerSq),
      )

  const activeBorrowerLead =
    borrowerLeads.find((l) => Number(l.id) === Number(activeBorrowerLeadId)) || null

  const selectedConversationIds = Object.keys(chatSelected).filter((key) => chatSelected[key])
  const selectedFeedbackIds = Object.keys(feedbackSelected).filter((key) => feedbackSelected[key])
  const selectedTicketIds = Object.keys(ticketSelected).filter((key) => ticketSelected[key])
  const hasConversationSelection = selectedConversationIds.length > 0

  const chatAuthMissing = !hasChatServerAuth()

  return (
    <div
      className={`relative flex h-full min-h-0 flex-1 flex-row overflow-hidden rounded-2xl bg-[var(--admin-bg)] text-[var(--admin-text)] ${chatAuthMissing ? 'pt-14' : ''}`}
    >
      {chatAuthMissing ? (
        <div
          className="absolute inset-x-0 top-0 z-[70] border-b border-amber-500/40 bg-amber-500/15 px-3 py-2.5 text-left text-xs leading-snug text-amber-950 shadow-sm sm:px-4 sm:text-center sm:text-sm"
          role="alert"
        >
          <strong className="font-semibold">Chat API secret missing.</strong>{' '}
          <span className="break-words">
            Add the same value to <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">amalgated-lending/.env</code> as{' '}
            <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">VITE_LENDING_ADMIN_API_SECRET=…</code> and to{' '}
            <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">chat-server/.env</code> as{' '}
            <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">LENDING_ADMIN_API_SECRET=…</code> (min 8 characters), then restart{' '}
            <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">npm run dev</code> and the chat server. Alias:{' '}
            <code className="rounded bg-black/10 px-1 text-[10px] sm:text-xs">VITE_CHAT_API_SECRET</code>. Node does not use your Laravel JWT for REST.
          </span>
        </div>
      ) : null}
      {newLeadAlert ? (
        <div
          className="absolute left-1/2 top-3 z-[60] flex max-w-[min(100%-1.5rem,28rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm text-emerald-900 shadow-lg dark:text-emerald-100"
          role="status"
        >
          <span className="font-semibold">New lead</span>
          <span className="truncate text-emerald-800/90 dark:text-emerald-200/90">
            {newLeadAlert.name || newLeadAlert.email || 'Someone'} submitted details.
          </span>
          <button
            type="button"
            className="ml-auto rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-500"
            onClick={() => {
              setNewLeadAlert(null)
              goToView('leads')
            }}
          >
            View leads
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs font-medium text-emerald-900 underline hover:no-underline dark:text-emerald-200"
            onClick={() => setNewLeadAlert(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      {/* Mobile overlay */}
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-40 bg-black/30 lg:hidden"
        />
      ) : null}

      {/* Sidebar: icon rail + conversations */}
      <div
        className={`absolute inset-y-0 left-0 z-50 flex w-[min(100%-0px,28rem)] max-w-[min(92vw,28rem)] overflow-hidden border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-[min(28rem,36vw)] lg:max-w-[28rem] lg:overflow-visible lg:shadow-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Desktop module rail — view icons only (brand & account live in main admin sidebar) */}
        <div className="hidden h-full min-h-0 w-[4.5rem] shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-sidebar)] pt-3 shadow-[1px_0_0_rgba(0,0,0,0.03)] lg:flex">
          <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto px-1.5 pb-3" aria-label="CRM views">
            {[
              ['Inbox', 'chats', 'inbox'],
              ['Leads', 'leads', 'leads'],
              ['Tickets', 'tickets', 'tickets'],
              ...(canViewAnalytics ? [['Analytics', 'analytics', 'analytics']] : []),
            ].map(([label, key, icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => goToView(key)}
                title={label}
                aria-current={view === key ? 'page' : undefined}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                  view === key
                    ? 'bg-[color:var(--admin-accent)] text-white shadow-md shadow-red-600/20'
                    : 'text-[color:var(--admin-muted)] hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]'
                }`}
              >
                <CrmNavIcon name={icon} />
              </button>
            ))}
          </nav>
        </div>

        {/* Conversations column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:min-w-0">
        <div className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-sidebar)] px-3 pb-2.5 pt-3 lg:bg-white">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 pr-2">
              <h1 className="text-[15px] font-semibold tracking-tight text-[var(--admin-text)]">
                {VIEW_TITLE[view] ?? 'Inbox'}
              </h1>
              <p className="break-words text-xs leading-snug text-[color:var(--admin-muted-2)]">
                {view === 'chats' && chatInboxTab === 'visitor' &&
                  `${filteredList.length} conversation${filteredList.length !== 1 ? 's' : ''}`}
                {view === 'chats' && chatInboxTab === 'borrower' &&
                  `${borrowerLeads.length} borrower thread${borrowerLeads.length !== 1 ? 's' : ''}`}
                {view === 'feedback' &&
                  `${feedbackList.length} feedback${feedbackList.length !== 1 ? 's' : ''}`}
                {view === 'leads' &&
                  `${leads.length} lead${leads.length !== 1 ? 's' : ''}`}
                {view === 'analytics' && 'Visitor analytics'}
                {view === 'tickets' &&
                  `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''}`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                  socketConnected
                    ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/25 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/25 dark:text-amber-400'
                }`}
                title={
                  socketConnected
                    ? 'Live updates connected'
                    : socketConnectError || 'Reconnecting… Run chat-server on port 8010 (npm run serve:chat).'
                }
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                {socketConnected ? 'Live' : 'Offline'}
              </span>
              <button
                onClick={handleRefresh}
                title="Refresh"
                disabled={refreshing}
                className="rounded-lg p-2 text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] active:scale-90 disabled:opacity-50"
              >
                <svg
                  className={`h-4 w-4 transition-transform duration-500 ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* View tabs (hide on desktop when icon rail exists) */}
          <div className="mt-3 flex max-w-full flex-nowrap gap-1.5 overflow-x-auto rounded-xl bg-[var(--admin-surface-2)] p-1.5 ring-1 ring-[var(--admin-border)] lg:hidden sm:flex-wrap sm:overflow-visible">
            <button onClick={() => goToView('chats')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${view === 'chats' ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm' : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'}`}>Chats</button>
            <button onClick={() => goToView('leads')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${view === 'leads' ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm' : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'}`}>Leads</button>
            {canViewAnalytics ? <button onClick={() => goToView('analytics')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${view === 'analytics' ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm' : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'}`}>Analytics</button> : null}
            <button onClick={() => goToView('tickets')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${view === 'tickets' ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm' : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'}`}>Tickets</button>
          </div>

          {view === 'chats' && (
            <div className="mt-2 flex max-w-full gap-1 rounded-xl bg-[var(--admin-surface-2)] p-1 ring-1 ring-[var(--admin-border)]">
              <button
                type="button"
                onClick={() => switchChatInbox('visitor')}
                className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition sm:text-xs ${
                  chatInboxTab === 'visitor'
                    ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm'
                    : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'
                }`}
              >
                Website chat
              </button>
              <button
                type="button"
                onClick={() => switchChatInbox('borrower')}
                className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-center text-[11px] font-semibold transition sm:text-xs ${
                  chatInboxTab === 'borrower'
                    ? 'bg-[var(--admin-surface)] text-[var(--admin-text)] shadow-sm'
                    : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'
                }`}
              >
                Borrower
              </button>
            </div>
          )}

          {view === 'chats' && chatInboxTab === 'visitor' && aiSessionMetrics ? (
            <div className="mt-2 space-y-2 px-0.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3 text-center shadow-sm">
                  <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--admin-text)]">
                    {aiSessionMetrics.activeVisitorSessions ?? 0}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium leading-snug text-[color:var(--admin-muted-2)]">
                    Active sessions
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3 text-center shadow-sm">
                  <p className="text-xl font-bold tabular-nums tracking-tight text-[color:var(--admin-accent)]">
                    {aiSessionMetrics.averageAiResponseMs != null
                      ? `${aiSessionMetrics.averageAiResponseMs} ms`
                      : '—'}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium leading-snug text-[color:var(--admin-muted-2)]">
                    Avg AI latency
                  </p>
                </div>
              </div>
              {Array.isArray(aiSessionMetrics.recentAiReplies) && aiSessionMetrics.recentAiReplies.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
                  <p className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--admin-muted)]">
                    Recent AI performance
                  </p>
                  <ul className="max-h-36 overflow-y-auto text-[11px]">
                    {aiSessionMetrics.recentAiReplies.map((row, idx) => (
                      <li
                        key={`${row.conversationId}-${row.at}-${idx}`}
                        className="flex items-center justify-between gap-2 border-b border-slate-100/80 px-3 py-2 last:border-0"
                      >
                        <span
                          className="min-w-0 truncate font-mono text-[10px] text-slate-600"
                          title={row.conversationId}
                        >
                          {shortConversationRef(row.conversationId)}
                        </span>
                        <span
                          className={`shrink-0 font-semibold tabular-nums ${responseTimeTextClass(row.delayMs)}`}
                        >
                          {row.delayMs} ms
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Unified inbox filters + bulk actions (visitor) */}
          {view === 'chats' && chatInboxTab === 'visitor' && (
            <div className="mt-2.5 space-y-2">
              <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--admin-muted)]">
                      Status
                    </p>
                    <div
                      className={`flex flex-wrap gap-1 ${visitorQueueBucket !== 'all' ? 'pointer-events-none opacity-50' : ''}`}
                      title={
                        visitorQueueBucket !== 'all'
                          ? 'Set queue to “All queues” to filter by status here.'
                          : undefined
                      }
                      role="tablist"
                      aria-label="Conversation status"
                    >
                      {FILTERS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          role="tab"
                          aria-selected={filter === f}
                          onClick={() => setFilter(f)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                            filter === f
                              ? 'bg-[color:var(--admin-accent)] text-white shadow-sm'
                              : 'bg-[var(--admin-surface-2)] text-[color:var(--admin-muted)] hover:bg-slate-200/80 hover:text-[var(--admin-text)]'
                          }`}
                        >
                          {FILTER_LABEL[f]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="w-full shrink-0 sm:max-w-[11rem]">
                    <label htmlFor="crm-queue-bucket" className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[color:var(--admin-muted)]">
                      Queue
                    </label>
                    <select
                      id="crm-queue-bucket"
                      value={visitorQueueBucket}
                      onChange={(e) => setVisitorQueueBucket(e.target.value)}
                      className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-2 text-xs font-medium text-[var(--admin-text)] outline-none focus:border-[color:var(--admin-accent)]/50 focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                    >
                      {VISITOR_QUEUE_BUCKETS.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="sr-only" htmlFor="crm-convo-search">
                    Search conversations
                  </label>
                  <input
                    id="crm-convo-search"
                    type="search"
                    placeholder="Search name, email, ID…"
                    value={convoSearch}
                    onChange={(e) => setConvoSearch(e.target.value)}
                    className="min-w-0 flex-1 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-2 text-xs text-[var(--admin-text)] outline-none placeholder:text-[color:var(--admin-muted-2)] focus:border-[color:var(--admin-accent)]/40 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
                  />
                  <div
                    className="flex shrink-0 rounded-xl bg-[var(--admin-surface-2)] p-0.5 ring-1 ring-[var(--admin-border)]"
                    role="group"
                    aria-label="Read state"
                  >
                    {[
                      ['all', 'All'],
                      ['unread', 'Unread'],
                      ['read', 'Read'],
                    ].map(([val, lab]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setChatReadFilter(val)}
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
                          chatReadFilter === val
                            ? 'bg-white text-[var(--admin-text)] shadow-sm'
                            : 'text-[color:var(--admin-muted)] hover:text-[var(--admin-text)]'
                        }`}
                      >
                        {lab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--admin-border)]/80 pt-2">
                  <p className="text-[10px] text-[color:var(--admin-muted-2)]">
                    {filteredList.length} match{filteredList.length !== 1 ? 'es' : ''}
                  </p>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = filteredList.map((c) => c.id)
                        const next = {}
                        allIds.forEach((id) => {
                          next[id] = true
                        })
                        setChatSelected(next)
                      }}
                      className="rounded-lg border border-transparent px-2 py-1 text-[11px] font-semibold text-[color:var(--admin-accent)] hover:bg-[color:var(--admin-accent)]/10"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setChatSelected({})}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-[color:var(--admin-muted)] hover:bg-[var(--admin-surface-2)]"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {hasConversationSelection ? (
                <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-blue-200/80 bg-blue-50/80 px-3 py-2 shadow-sm">
                  <span className="text-[11px] font-semibold text-slate-800">
                    {selectedConversationIds.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => bulkAction('conversations', 'markRead', selectedConversationIds)}
                    className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-slate-50"
                  >
                    Read
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkAction('conversations', 'markUnread', selectedConversationIds)}
                    className="rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/80 hover:bg-slate-50"
                  >
                    Unread
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkAction('conversations', 'delete', selectedConversationIds)}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {view === 'chats' && chatInboxTab === 'borrower' && (
            <div className="mt-2.5">
              <label className="sr-only" htmlFor="crm-borrower-inbox-search">
                Search borrower threads
              </label>
              <input
                id="crm-borrower-inbox-search"
                type="search"
                placeholder="Search borrower name or email…"
                value={borrowerInboxSearch}
                onChange={(e) => setBorrowerInboxSearch(e.target.value)}
                className="w-full rounded-md border border-[var(--admin-border)] bg-white px-2.5 py-1.5 text-xs text-[var(--admin-text)] outline-none placeholder:text-[color:var(--admin-muted-2)] focus:border-slate-300 focus:ring-1 focus:ring-slate-200"
              />
              <p className="mt-1 text-[10px] text-[color:var(--admin-muted-2)]">
                Same threads as borrower Chat in the portal (Laravel). Showing {filteredBorrowerLeads.length} thread
                {filteredBorrowerLeads.length !== 1 ? 's' : ''}.
              </p>
            </div>
          )}

          {view === 'feedback' && (
            <div className="mt-3 space-y-2">
              <select
                value={feedbackReadFilter}
                onChange={(event) => setFeedbackReadFilter(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] outline-none focus:border-[color:var(--admin-accent)]/60 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allIds = filteredFeedback.map((f) => f.id)
                    const next = {}
                    allIds.forEach((id) => {
                      next[id] = true
                    })
                    setFeedbackSelected(next)
                  }}
                  className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                >
                  Select all
                </button>
                <button
                  onClick={() => setFeedbackSelected({})}
                  className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {view === 'tickets' && (
            <div className="mt-3 space-y-2">
              <select
                value={ticketStatusFilter}
                onChange={(event) => setTicketStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] outline-none focus:border-[color:var(--admin-accent)]/60 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
              >
                <option value="all">All statuses</option>
                <option value="open">Open</option>
                <option value="pending">Pending</option>
                <option value="closed">Closed</option>
              </select>
              <select
                value={ticketReadFilter}
                onChange={(event) => setTicketReadFilter(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] outline-none focus:border-[color:var(--admin-accent)]/60 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
              >
                <option value="all">All</option>
                <option value="unread">Unread</option>
                <option value="read">Read</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const allIds = filteredTickets.map((t) => t.id)
                    const next = {}
                    allIds.forEach((id) => {
                      next[id] = true
                    })
                    setTicketSelected(next)
                  }}
                  className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                >
                  Select all
                </button>
                <button
                  onClick={() => setTicketSelected({})}
                  className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {view === 'leads' && (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                placeholder="Search leads..."
                value={leadsSearch}
                onChange={(event) => setLeadsSearch(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] outline-none placeholder:text-[color:var(--admin-muted-2)] focus:border-[color:var(--admin-accent)]/60 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
              />
              <select
                value={leadsFilter}
                onChange={(event) => setLeadsFilter(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs text-[var(--admin-text)] outline-none focus:border-[color:var(--admin-accent)]/60 focus:ring-2 focus:ring-[color:var(--admin-accent)]/15"
              >
                <option value="">All statuses</option>
                {Object.entries(LEAD_STATUS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Conversation / list column */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[var(--admin-sidebar)]">
          {view === 'chats' && chatInboxTab === 'visitor' && (
            <>
              {filteredList.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-medium text-[color:var(--admin-muted)]">
                    {searchQ ? 'No conversations match your search' : 'No conversations yet'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--admin-muted-2)]">
                    {searchQ ? 'Try a different name, email, or the short ref (last digits of the ID).' : 'New visitor chats will appear here in real time.'}
                  </p>
                </div>
              )}
              {filteredList.map((c) => {
                const isActive = activeId === c.id
                const initials = getInitials(c.visitor_name)
                const color = getAvatarColor(c.id)
                const unread = (c.admin_unread_count ?? c.unread_count ?? 0) > 0
                const connDot = visitorAiConnectionDot(c, visitorPresenceMap)
                return (
                  <div
                    key={c.id}
                    className={`mx-1.5 my-1 flex w-full min-w-0 max-w-full items-start gap-2 rounded-xl border bg-white px-2.5 py-2.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md ${
                      isActive
                        ? 'border-[color:var(--admin-accent)]/50 ring-2 ring-[color:var(--admin-accent)]/20'
                        : 'border-[var(--admin-border)]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={!!chatSelected[c.id]}
                      onChange={(event) =>
                        setChatSelected((prev) => ({
                          ...prev,
                          [c.id]: event.target.checked,
                        }))
                      }
                    />
                    <button
                      onClick={() => {
                        setActiveId(c.id)
                        goToView('chats')
                        if (window.innerWidth < 768) setSidebarOpen(false)
                      }}
                      className="flex flex-1 items-start gap-2 text-left"
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${color}`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-1.5">
                          <span className="min-w-0 truncate text-sm font-semibold leading-tight text-[var(--admin-text)]">
                            {displayName(c)}
                            <span className="ml-1 align-middle text-[8px] font-bold uppercase tracking-wide text-slate-500">
                              · Web
                            </span>
                            {unread ? (
                              <span className="ml-1 inline-flex rounded-md bg-red-50 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-[color:var(--admin-accent)] ring-1 ring-red-200/90">
                                New
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold ${STATUS_BADGE[c.status]}`}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[color:var(--admin-muted-2)]">
                          {conversationListSubtitle(c)}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[color:var(--admin-muted-2)]">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${connDot.className}`}
                            title={connDot.title}
                          />
                          <span className="tabular-nums">{fmtDate(c.updated_at)}</span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide ${
                              c.mode === 'human'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {c.mode === 'human' ? 'Human' : 'AI'}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </>
          )}

          {view === 'chats' && chatInboxTab === 'borrower' && (
            <>
              {filteredBorrowerLeads.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <p className="text-base font-medium text-[color:var(--admin-muted)]">
                    {borrowerLeads.length === 0 ? 'No borrower chats yet' : 'No threads match your search'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--admin-muted-2)]">
                    {borrowerLeads.length === 0
                      ? 'When a borrower uses Chat in the portal, their thread appears here.'
                      : 'Try another name or email.'}
                  </p>
                </div>
              )}
              {filteredBorrowerLeads.map((lead) => {
                const isActive = activeBorrowerLeadId === lead.id
                const initials = getInitials(lead.name)
                const color = getAvatarColor(String(lead.id))
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => {
                      setActiveBorrowerLeadId(lead.id)
                      goToView('chats')
                      if (window.innerWidth < 768) setSidebarOpen(false)
                    }}
                    className={`mx-1.5 my-1 flex w-full min-w-0 max-w-full items-start gap-2 rounded-xl border bg-white px-2.5 py-2.5 text-left shadow-sm transition hover:border-slate-300 hover:shadow-md ${
                      isActive
                        ? 'border-[color:var(--admin-accent)]/50 ring-2 ring-[color:var(--admin-accent)]/20'
                        : 'border-[var(--admin-border)]'
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white ${color}`}>
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <span className="min-w-0 truncate text-sm font-semibold leading-tight text-[var(--admin-text)]">
                          {lead.name || 'Borrower'}
                          <span className="ml-1 align-middle text-[8px] font-bold uppercase tracking-wide text-[color:var(--admin-accent)]">
                            · Portal
                          </span>
                        </span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-px text-[9px] font-semibold ${
                            STATUS_BADGE[
                              lead.status === 'new'
                                ? 'open'
                                : lead.status === 'contacted' || lead.status === 'qualified'
                                  ? 'in_progress'
                                  : 'archived'
                            ]
                          }`}
                        >
                          {LEAD_STATUS[lead.status] || lead.status}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-[color:var(--admin-muted-2)]">{lead.email || '—'}</p>
                      <p className="mt-0.5 text-[10px] text-[color:var(--admin-muted-2)]">
                        {lead.last_message_at ? fmtDate(lead.last_message_at) : ''}
                      </p>
                    </div>
                  </button>
                )
              })}
            </>
          )}

          {view === 'feedback' && (
            <>
              {feedbackLoading && (
                <p className="px-5 py-10 text-center text-sm text-gray-400">
                  Loading...
                </p>
              )}
              {!feedbackLoading && feedbackList.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-gray-400">
                  No feedback yet
                </p>
              )}
              {!feedbackLoading &&
                filteredFeedback.map((fb, index) => (
                  <div
                    key={fb.id || index}
                    className="group mx-2 my-2 flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={!!feedbackSelected[fb.id]}
                      onChange={(event) =>
                        setFeedbackSelected((prev) => ({
                          ...prev,
                          [fb.id]: event.target.checked,
                        }))
                      }
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!fb.is_read) {
                          bulkAction('feedback', 'markRead', [fb.id])
                        }
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && !fb.is_read) {
                          e.preventDefault()
                          bulkAction('feedback', 'markRead', [fb.id])
                        }
                      }}
                      className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-primary/30`}
                    >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(
                        fb.name || 'A',
                      )}`}
                    >
                      {getInitials(fb.name || 'Anonymous')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-gray-800">
                          {fb.name || 'Anonymous'}
                          {!fb.is_read ? (
                            <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                              Unread
                            </span>
                          ) : null}
                        </span>
                        <span className="flex shrink-0 gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span
                              key={s}
                              className={`text-[10px] ${
                                fb.rating >= s ? 'text-amber-400' : 'text-gray-200'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-gray-600">
                        {fb.comment}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {fmtDate(fb.created_at)}
                      </p>
                    </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteFeedbackTarget(fb.id) }}
                      title="Delete feedback"
                      className="shrink-0 rounded-md p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
            </>
          )}

          {view === 'leads' && (
            <div className="px-3 py-2 text-center text-xs text-gray-400">
              Use the main area to view full lead details.
            </div>
          )}

          {view === 'analytics' && (
            <div className="px-3 py-2 text-center text-xs text-gray-400">
              Charts and analytics appear in the main area.
            </div>
          )}

          {view === 'tickets' && (
            <>
              {filteredTickets.length === 0 && (
                <p className="px-5 py-10 text-center text-sm text-gray-400">
                  No tickets
                </p>
              )}
              {filteredTickets.map((t) => (
                <div
                  key={t.id}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-5 py-3 text-left transition hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={!!ticketSelected[t.id]}
                    onChange={(event) =>
                      setTicketSelected((prev) => ({
                        ...prev,
                        [t.id]: event.target.checked,
                      }))
                    }
                  />
                  <button
                    onClick={() => setTicketModal(t)}
                    className="flex flex-1 items-center justify-between"
                  >
                    <span className="truncate text-xs font-mono text-gray-700">
                      {t.ticket_id}
                      {t.is_unread ? (
                        <span className="ml-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                          Unread
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === 'open'
                          ? 'bg-yellow-100 text-yellow-700'
                          : t.status === 'pending'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {TICKET_STATUS[t.status]}
                    </span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
      </div>

      {/* Main conversation/detail area — SaaS-style center + optional profile (Intercom-style) */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-l border-[var(--admin-border)]/60 bg-[var(--admin-bg)] lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--admin-bg)]">
        <div className="sticky top-0 z-20 flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] bg-white px-2 py-2 shadow-sm sm:px-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen((value) => !value)}
              className="rounded-lg p-1.5 text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] lg:hidden"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            {view === 'feedback' ? (
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">
                  Customer Feedback
                </p>
                <p className="text-[11px] text-[color:var(--admin-muted-2)]">
                  {feedbackList.length} total submission
                  {feedbackList.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : view === 'leads' ? (
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">CRM — Leads</p>
                <p className="text-[11px] text-[color:var(--admin-muted-2)]">
                  {leads.length} lead{leads.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : view === 'analytics' ? (
              <div>
                <p className="text-base font-semibold text-[var(--admin-text)]">
                  Visitor Analytics
                </p>
                <p className="text-sm text-[color:var(--admin-muted-2)]">Last 7 days</p>
              </div>
            ) : view === 'tickets' ? (
              <div>
                <p className="text-sm font-semibold text-[var(--admin-text)]">
                  Support Tickets
                </p>
                <p className="text-[11px] text-[color:var(--admin-muted-2)]">
                  {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
                </p>
              </div>
            ) : view === 'chats' && chatInboxTab === 'borrower' && activeBorrowerLead ? (
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(
                    String(activeBorrowerLead.id),
                  )}`}
                >
                  {getInitials(activeBorrowerLead.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--admin-text)]">
                    {activeBorrowerLead.name || 'Borrower'}
                  </p>
                  <p className="truncate text-[11px] text-[color:var(--admin-muted-2)]">
                    {activeBorrowerLead.email || 'No email'}
                    {activeBorrowerLead.loan_type ? ` · ${activeBorrowerLead.loan_type}` : ''}
                  </p>
                </div>
              </div>
            ) : activeConvo ? (
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(
                    activeConvo.id,
                  )}`}
                >
                  {getInitials(activeConvo.visitor_name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--admin-text)]">
                    {displayName(activeConvo)}
                  </p>
                  <p className="text-[11px] text-[color:var(--admin-muted-2)]">
                    {activeConvo.visitor_email || 'No email'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[color:var(--admin-muted)]">
                {view === 'chats' && chatInboxTab === 'borrower'
                  ? 'Select a borrower thread to reply'
                  : 'Select a conversation to start replying'}
              </p>
            )}
          </div>

          {view === 'chats' && chatInboxTab === 'visitor' && (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {activeConvo ? (
                <>
                  <button
                    type="button"
                    onClick={() => setCrmProfileOpen((v) => !v)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${
                      crmProfileOpen
                        ? 'border-[color:var(--admin-accent)] bg-red-50 text-[color:var(--admin-accent)]'
                        : 'border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]'
                    }`}
                  >
                    Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleAIMode(activeId)}
                    title={
                      activeConvo.mode === 'ai'
                        ? 'AI replies on. Click for human-only mode.'
                        : 'Human-only. Click to let AI assist again.'
                    }
                    className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide shadow-sm ring-1 transition ${
                      activeConvo.mode === 'ai'
                        ? 'bg-[color:var(--admin-accent)] text-white ring-red-700/35 hover:opacity-95'
                        : 'border border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]'
                    }`}
                    aria-pressed={activeConvo.mode === 'ai'}
                  >
                    {activeConvo.mode === 'ai' ? 'AI on' : 'Human'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTicketModal({ conversation_id: activeId })}
                    className="rounded-xl border border-[var(--admin-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--admin-text)] shadow-sm hover:bg-[var(--admin-surface-2)]"
                    title="Create support ticket"
                  >
                    Ticket
                  </button>
                  <button
                    type="button"
                    disabled={conversationWarehouseBusy || !!activeConvo?.needs_human}
                    onClick={() => patchConversationNeedsHuman(true)}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Escalate
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setStatusDropdown((value) => !value)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold shadow-sm ring-1 transition ${STATUS_BADGE[activeConvo.status]}`}
                    >
                      {STATUS_LABEL[activeConvo.status]}
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {statusDropdown ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-10 cursor-default bg-transparent"
                          aria-label="Close menu"
                          onClick={() => setStatusDropdown(false)}
                        />
                        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                          {['open', 'in_progress', 'resolved', 'archived'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => changeStatus(activeId, status)}
                              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-[var(--admin-surface-2)] ${
                                activeConvo.status === status
                                  ? 'font-semibold text-[var(--admin-text)]'
                                  : 'text-[color:var(--admin-muted)]'
                              }`}
                            >
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  status === 'open'
                                    ? 'bg-amber-400'
                                    : status === 'in_progress'
                                      ? 'bg-[color:var(--admin-accent)]'
                                      : status === 'resolved'
                                        ? 'bg-emerald-500'
                                        : 'bg-slate-400'
                                }`}
                              />
                              {STATUS_LABEL[status]}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </div>
                  <details className="relative">
                    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-xl border border-[var(--admin-border)] bg-white text-[color:var(--admin-muted)] shadow-sm marker:hidden [&::-webkit-details-marker]:hidden hover:bg-[var(--admin-surface-2)]">
                      <span className="sr-only">More actions</span>
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M12 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 5.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                      </svg>
                    </summary>
                    <div className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                      {canAssignStaff ? (
                        <div className="border-b border-[var(--admin-border)] px-3 py-2">
                          <label htmlFor="crm-assign-toolbar" className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[color:var(--admin-muted)]">
                            Assign to
                          </label>
                          <select
                            id="crm-assign-toolbar"
                            disabled={conversationWarehouseBusy || assignStaffRows.length === 0}
                            value={
                              activeConvo?.assigned_to != null && activeConvo.assigned_to !== ''
                                ? String(activeConvo.assigned_to)
                                : ''
                            }
                            onChange={(ev) => {
                              const next = ev.target.value
                              if (!next) return
                              assignConversationToStaff(next)
                            }}
                            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/25 disabled:opacity-50"
                          >
                            <option value="">Choose staff…</option>
                            {assignStaffRows.map((u) => (
                              <option key={u.id} value={String(u.id)}>
                                {u.name || u.email || `User ${u.id}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                      <button
                        type="button"
                        disabled={conversationWarehouseBusy || !activeConvo?.needs_human}
                        onClick={() => patchConversationNeedsHuman(false)}
                        className="flex w-full px-3 py-2 text-left text-xs font-semibold text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)] disabled:opacity-40"
                      >
                        Clear escalation
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(activeId)}
                        className="flex w-full px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        Delete thread…
                      </button>
                    </div>
                  </details>
                </>
              ) : null}
            </div>
          )}

          {view === 'chats' && chatInboxTab === 'borrower' && activeBorrowerLead && (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCrmProfileOpen((v) => !v)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                  crmProfileOpen
                    ? 'border-[color:var(--admin-accent)] bg-red-50 text-[color:var(--admin-accent)]'
                    : 'border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-2)]'
                }`}
              >
                Profile
              </button>
              {canViewBorrowers && activeBorrowerLead.user_id ? (
                <Link
                  to={`/admin/borrowers/${activeBorrowerLead.user_id}`}
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-accent)] transition hover:bg-[var(--admin-surface-2)]"
                >
                  Open borrower record
                </Link>
              ) : null}
            </div>
          )}

          {view === 'analytics' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAnalytics()}
                disabled={analyticsLoading}
                title="Refresh analytics"
                className="flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] focus:outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20 disabled:opacity-50"
              >
                <svg
                  className={`h-3.5 w-3.5 ${analyticsLoading ? 'animate-spin' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 11-2.636-2.636" />
                  <path d="M21 3v5h-5" />
                </svg>
                Refresh
              </button>
            </div>
          )}

          {view === 'feedback' && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--admin-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--admin-muted)] ring-1 ring-[var(--admin-border)]">
                Selected: {selectedFeedbackIds.length}
              </span>
              <button
                onClick={() =>
                  bulkAction('feedback', 'markRead', selectedFeedbackIds)
                }
                disabled={!selectedFeedbackIds.length}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark read
              </button>
              <button
                onClick={() =>
                  bulkAction('feedback', 'markUnread', selectedFeedbackIds)
                }
                disabled={!selectedFeedbackIds.length}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark unread
              </button>
              <button
                onClick={() =>
                  bulkAction('feedback', 'delete', selectedFeedbackIds)
                }
                disabled={!selectedFeedbackIds.length}
                className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-danger-text)] transition hover:bg-rose-500/15 focus:outline-none focus:ring-2 focus:ring-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete selected
              </button>
            </div>
          )}

          {view === 'tickets' && (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--admin-surface-2)] px-2.5 py-1 text-[11px] font-medium text-[color:var(--admin-muted)] ring-1 ring-[var(--admin-border)]">
                Selected: {selectedTicketIds.length}
              </span>
              <button
                onClick={() =>
                  bulkAction('tickets', 'markRead', selectedTicketIds)
                }
                disabled={!selectedTicketIds.length}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark read
              </button>
              <button
                onClick={() =>
                  bulkAction('tickets', 'markUnread', selectedTicketIds)
                }
                disabled={!selectedTicketIds.length}
                className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark unread
              </button>
              <button
                onClick={() =>
                  bulkAction('tickets', 'delete', selectedTicketIds)
                }
                disabled={!selectedTicketIds.length}
                className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-danger-text)] transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete selected
              </button>
            </div>
          )}

          {view === 'leads' && (
            <button
              onClick={exportLeadsCsv}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
            >
              Export CSV
            </button>
          )}

        </div>

        {/* Main content area */}
        <div
          ref={scrollRef}
          className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_55%)] px-2 py-2 text-[var(--admin-text)] sm:px-3 sm:py-3"
        >
          {view === 'chats' && chatInboxTab === 'visitor' && activeId && activeConvo && (
            <div className="mb-3 space-y-2">
              <details className="group rounded-xl border border-amber-200/90 bg-amber-50/95 text-[11px] text-amber-950 shadow-sm">
                <summary className="cursor-pointer list-none px-3 py-2 font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 shrink-0 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                    </svg>
                    Visitor connection tip
                  </span>
                </summary>
                <p className="border-t border-amber-200/60 px-3 py-2 leading-relaxed text-amber-900/95">
                  Amber status dot on the inbox card means the visitor is not on the live AI stream yet—ask them to wait until it turns green before expecting instant AI replies.
                </p>
              </details>
              {warehouseActionError ? (
                <div
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-950 shadow-sm"
                  role="alert"
                >
                  {warehouseActionError}
                </div>
              ) : null}
              {activeConvo?.needs_human ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-[11px] font-medium text-amber-950 shadow-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                  Escalated — awaiting human response
                </div>
              ) : null}
            </div>
          )}
          {/* Leads table */}
          {view === 'leads' && (
            <div className="w-full min-w-0 max-w-none">
              <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
                <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[900px] text-left text-xs sm:text-sm">
                    <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-2)]">
                      <tr>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">Name</th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Email
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Phone
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Company
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Inquiry
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Source
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Status
                        </th>
                        <th className="px-2 py-2 font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">Created</th>
                        <th className="px-2 py-2 text-right font-semibold text-[color:var(--admin-muted)] sm:px-4 sm:py-3">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length === 0 && (
                        <tr>
                          <td
                            colSpan={9}
                            className="px-2 py-8 text-center text-[color:var(--admin-muted)] sm:px-4"
                          >
                            No leads yet
                          </td>
                        </tr>
                      )}
                      {leads.map((lead) => (
                        <tr
                          key={lead.id}
                          className="border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-2)]"
                        >
                          <td className="px-2 py-2 font-medium text-[var(--admin-text)] sm:px-4 sm:py-3">
                            {lead.name}
                          </td>
                          <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-3 dark:text-gray-300">
                            {lead.email ? (
                              <a
                                href={`mailto:${encodeURIComponent(lead.email)}`}
                                className="text-[color:var(--admin-accent)] underline-offset-2 hover:underline"
                              >
                                {lead.email}
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-3">
                            {lead.phone || '—'}
                          </td>
                          <td className="px-2 py-2 text-gray-600 sm:px-4 sm:py-3">
                            {lead.company || '—'}
                          </td>
                          <td
                            className="max-w-[200px] truncate px-2 py-2 text-gray-600 sm:px-4 sm:py-3"
                            title={lead.inquiry_message}
                          >
                            {lead.inquiry_message || '—'}
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-500 sm:px-4 sm:py-3">
                            {lead.source_page || '—'}
                          </td>
                          <td className="px-2 py-2 sm:px-4 sm:py-3">
                            <select
                              value={lead.status}
                              onChange={(event) =>
                                updateLeadStatusById(lead.id, event.target.value)
                              }
                              className="rounded border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700"
                            >
                              {Object.entries(LEAD_STATUS).map(([key, value]) => (
                                <option key={key} value={key}>
                                  {value}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-2 py-2 text-xs text-gray-400 sm:px-4 sm:py-3">
                            {fmtDate(lead.created_at)}
                          </td>
                          <td className="px-2 py-2 text-right sm:px-4 sm:py-3">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <button
                                type="button"
                                title={lead.email ? 'Send email to this lead' : 'No email on file'}
                                disabled={!lead.email}
                                onClick={() => openLeadEmailModal(lead)}
                                className="inline-flex items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-3 py-1 text-xs font-semibold text-[var(--admin-text)] transition hover:bg-[var(--admin-border)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Email
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const ok = window.confirm('Delete this lead? This cannot be undone.')
                                  if (!ok) return
                                  await deleteLeadById(lead.id)
                                }}
                                className="inline-flex items-center rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-500"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Analytics */}
          {view === 'analytics' && (
            <div className="w-full min-w-0 space-y-4 px-1 py-1 sm:space-y-6 sm:px-2 sm:py-2">
              {analyticsError && (
                <div
                  className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
                  role="alert"
                >
                  {analyticsError}
                </div>
              )}
              {warehouseAnalytics?.totals && (
                <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50/90 p-4 text-slate-800">
                  <p className="mb-3 text-sm font-semibold text-sky-950">Support warehouse · Laravel · last 30 days</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-slate-800">{warehouseAnalytics.totals.messages}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Messages</p>
                    </div>
                    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-slate-800">{warehouseAnalytics.totals.feedback}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Feedback</p>
                    </div>
                    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-emerald-700">{warehouseAnalytics.rates?.ai_reply_share}%</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">AI replies</p>
                    </div>
                    <div className="rounded-lg bg-white/80 px-3 py-2 text-center">
                      <p className="text-lg font-bold text-rose-700">
                        {warehouseAnalytics.totals.average_rating ?? '–'}
                      </p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Avg rating</p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-right text-xs text-gray-500">
                From database · updates every 15s and when visitors join or message
              </p>
              {analyticsLoading && !analytics && (
                <p className="text-center text-gray-400">Loading analytics...</p>
              )}
              {!analyticsLoading && analytics && (
                <>
                  <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-5">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center sm:px-5 sm:py-4">
                      <p className="text-xl font-bold text-slate-600 sm:text-2xl">
                        {analytics.viewersCount ?? 0}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Website viewers</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">Viewed site, no message</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center sm:px-5 sm:py-4">
                      <p className="text-xl font-bold text-emerald-600 sm:text-2xl">
                        {analytics.messagedCount ?? 0}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Visitors who messaged</p>
                      <p className="mt-0.5 text-[10px] text-gray-400">Sent at least 1 message</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center sm:px-5 sm:py-4">
                      <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                        {analytics.totalMessages}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Messages</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center sm:px-5 sm:py-4">
                      <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                        {Math.floor((analytics.avgDurationSeconds || 0) / 60)}m
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Avg duration</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-center sm:px-5 sm:py-4">
                      <p className="text-xl font-bold text-gray-900 sm:text-2xl">
                        {analytics.totalVisits}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Total visits</p>
                    </div>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      By device
                    </p>
                    <div className="space-y-2">
                      {Object.entries(analytics.byDevice || {}).length === 0 ? (
                        <p className="text-xs text-gray-400">None in period</p>
                      ) : (
                        Object.entries(analytics.byDevice || {}).map(
                          ([label, count]) => (
                            <div
                              key={label}
                              className="flex min-w-0 items-center gap-2 sm:gap-3"
                            >
                              <span className="w-16 shrink-0 truncate text-xs text-gray-600 sm:w-20">
                                {label}
                              </span>
                              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-brand-primary"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    (count / (analytics.visits || 1)) * 100,
                                  )}%`,
                                }}
                              />
                            </div>
                              <span className="shrink-0 text-xs font-medium text-gray-700">
                                {count}
                              </span>
                            </div>
                          ),
                        )
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      By browser
                    </p>
                    <div className="space-y-2">
                      {Object.entries(analytics.byBrowser || {}).length === 0 ? (
                        <p className="text-xs text-gray-400">None in period</p>
                      ) : (
                        Object.entries(analytics.byBrowser || {}).map(
                          ([label, count]) => (
                            <div
                              key={label}
                              className="flex min-w-0 items-center gap-2 sm:gap-3"
                            >
                              <span className="w-16 shrink-0 truncate text-xs text-gray-600 sm:w-20">
                                {label}
                              </span>
                              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-brand-primary"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (count / (analytics.visits || 1)) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="shrink-0 text-xs font-medium text-gray-700">
                                {count}
                              </span>
                            </div>
                          ),
                        )
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      By location
                    </p>
                    <div className="space-y-2">
                      {Object.entries(analytics.byLocation || {}).length === 0 ? (
                        <p className="text-xs text-gray-400">None in period</p>
                      ) : (
                        Object.entries(analytics.byLocation || {})
                          .slice(0, 10)
                          .map(([label, count]) => (
                            <div
                              key={label}
                              className="flex min-w-0 items-center gap-2 sm:gap-3"
                            >
                              <span className="w-20 truncate text-xs text-gray-600 sm:w-32">
                                {label}
                              </span>
                              <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className="h-full rounded-full bg-brand-primary"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (count / (analytics.visits || 1)) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="shrink-0 text-xs font-medium text-gray-700">
                                {count}
                              </span>
                            </div>
                          ))
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
                    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                      <p className="mb-3 text-sm font-semibold text-slate-600">
                        Recent website viewers
                      </p>
                      <p className="mb-2 text-xs text-gray-500">
                        Visitors who opened the site but did not send a message
                      </p>
                      {(analytics.recentViewers || []).length === 0 ? (
                        <p className="text-xs text-gray-400">None in period</p>
                      ) : (
                        <ul className="max-h-56 space-y-2 overflow-y-auto">
                          {(analytics.recentViewers || []).map((v) => (
                            <li
                              key={v.visit_id}
                              className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1.5 text-xs"
                            >
                              <span className="truncate text-gray-700">
                                {v.device || '?'} · {v.browser || '?'}
                              </span>
                              <span className="shrink-0 text-gray-500">
                                {v.last_activity_at
                                  ? fmtDate(v.last_activity_at)
                                  : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
                      <p className="mb-3 text-sm font-semibold text-emerald-600">
                        Recent visitors who messaged
                      </p>
                      <p className="mb-2 text-xs text-gray-500">
                        Visitors who sent at least one message in chat
                      </p>
                      {(analytics.recentMessaged || []).length === 0 ? (
                        <p className="text-xs text-gray-400">None in period</p>
                      ) : (
                        <ul className="max-h-56 space-y-2 overflow-y-auto">
                          {(analytics.recentMessaged || []).map((v) => (
                            <li
                              key={v.visit_id}
                              className="flex items-center justify-between gap-2 rounded border border-emerald-50 px-2 py-1.5 text-xs"
                            >
                              <span className="truncate text-gray-700">
                                {v.device || '?'} · {v.browser || '?'} · {v.message_count || 0} msg
                              </span>
                              <span className="shrink-0 text-gray-500">
                                {v.last_activity_at
                                  ? fmtDate(v.last_activity_at)
                                  : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}
              {!analyticsLoading && !analytics && !analyticsError && (
                <p className="text-center text-gray-400">No data yet. Open the site in another tab and use the chat to generate visitor analytics.</p>
              )}
            </div>
          )}

          {/* Tickets list detail view */}
          {view === 'tickets' && (
            <div className="w-full min-w-0 space-y-4 px-1">
              {tickets.length === 0 && (
                <p className="py-10 text-center text-gray-400">
                  No tickets. Create one from a conversation (open a chat and click
                  &quot;Create ticket&quot;).
                </p>
              )}
              {tickets.map((ticket) => (
                <div
                  key={ticket.id}
                  className="rounded-xl border border-gray-200 bg-white p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-mono text-sm font-semibold text-gray-900">
                        {ticket.ticket_id}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Conversation: {ticket.conversation_id}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={ticket.priority}
                        onChange={(event) =>
                          updateTicketById(ticket.id, {
                            priority: event.target.value,
                          })
                        }
                        className="rounded border border-gray-200 px-2 py-1 text-xs"
                      >
                        {Object.entries(TICKET_PRIORITY).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                      <select
                        value={ticket.status}
                        onChange={(event) =>
                          updateTicketById(ticket.id, {
                            status: event.target.value,
                          })
                        }
                        className="rounded border border-gray-200 px-2 py-1 text-xs"
                      >
                        {Object.entries(TICKET_STATUS).map(([key, value]) => (
                          <option key={key} value={key}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-gray-500">Assigned:</span>
                    <input
                      type="text"
                      placeholder="Staff name"
                      defaultValue={ticket.assigned_staff || ''}
                      onBlur={(event) =>
                        updateTicketById(ticket.id, {
                          assigned_staff: event.target.value || null,
                        })
                      }
                      className="max-w-[200px] flex-1 rounded border border-gray-200 px-2 py-1 text-xs"
                    />
                  </div>
                  {ticket.notes !== undefined && (
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Notes:</span>
                      <p className="mt-0.5 text-sm text-gray-700">
                        {ticket.notes || '—'}
                      </p>
                    </div>
                  )}
                  <textarea
                    placeholder="Add or edit notes..."
                    defaultValue={ticket.notes || ''}
                    onBlur={(event) =>
                      updateTicketById(ticket.id, {
                        notes: event.target.value || null,
                      })
                    }
                    className="mt-2 w-full rounded border border-gray-200 px-3 py-2 text-xs outline-none focus:border-brand-primary"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Feedback overview cards */}
          {view === 'feedback' && (
            <div className="mx-auto w-full max-w-full px-2">
              {(() => {
                const total = feedbackList.length
                const average =
                  total > 0
                    ? (feedbackList.reduce((sum, f) => sum + f.rating, 0) / total).toFixed(
                        1,
                      )
                    : '0.0'
                const positive = feedbackList.filter((f) => f.rating >= 4).length
                return (
                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{total}</p>
                      <p className="mt-0.5 text-xs text-gray-400">Total</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-center">
                      <p className="text-2xl font-bold text-amber-500">{average}</p>
                      <p className="mt-0.5 text-xs text-gray-400">Avg Rating</p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 text-center">
                      <p className="text-2xl font-bold text-emerald-500">
                        {positive}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">Positive</p>
                    </div>
                  </div>
                )
              })()}

              <div className="space-y-3">
                {feedbackList.length === 0 && !feedbackLoading && (
                  <p className="py-10 text-center text-sm text-gray-400">
                    No feedback submissions yet
                  </p>
                )}
                {feedbackList.map((fb, index) => (
                  <div
                    key={fb.id || index}
                    className="group rounded-xl border border-gray-200 bg-white px-5 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getAvatarColor(
                            fb.name || 'A',
                          )}`}
                        >
                          {getInitials(fb.name || 'Anonymous')}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {fb.name || 'Anonymous'}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {fb.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <span
                              key={s}
                              className={`text-sm ${
                                fb.rating >= s ? 'text-amber-400' : 'text-gray-200'
                              }`}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => setDeleteFeedbackTarget(fb.id)}
                          title="Delete feedback"
                          className="rounded-md p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-400"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                      {fb.comment}
                    </p>
                    <p className="mt-2 text-[10px] text-gray-400">
                      {fmtDate(fb.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {view === 'chats' && chatInboxTab === 'visitor' && !activeId && (
            <div className="flex min-h-[min(280px,calc(100dvh-14rem))] w-full flex-col items-stretch justify-center px-2 py-6 sm:px-4">
              <div className="w-full rounded-xl border border-slate-200/90 bg-white px-5 py-6 text-center shadow-sm sm:px-8 sm:py-8">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <svg
                    className="h-6 w-6 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-[15px] font-semibold text-slate-900">Choose a conversation</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Pick a thread from the inbox to read messages and reply.
                </p>
              </div>
            </div>
          )}

          {view === 'chats' && chatInboxTab === 'borrower' && !activeBorrowerLeadId && (
            <div className="flex min-h-[min(280px,calc(100dvh-14rem))] w-full flex-col items-stretch justify-center px-2 py-6 sm:px-4">
              <div className="w-full rounded-xl border border-slate-200/90 bg-white px-5 py-6 text-center shadow-sm sm:px-8 sm:py-8">
                <p className="text-[15px] font-semibold text-slate-900">Choose a borrower thread</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Select a borrower on the left to read messages from the portal chat and reply.
                </p>
              </div>
            </div>
          )}

          {view === 'chats' &&
            chatInboxTab === 'visitor' &&
            activeId &&
            messages.length === 0 && (
              <div className="flex min-h-[min(320px,calc(100dvh-18rem))] w-full flex-col items-stretch justify-center px-2 py-4 sm:px-4">
                <div className="w-full rounded-xl border border-dashed border-slate-300/90 bg-white/95 px-5 py-8 text-center shadow-sm sm:px-10 sm:py-10">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <svg className="h-7 w-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-base font-semibold text-slate-900">No messages yet</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Send a short greeting below, or wait for the visitor to write first.
                  </p>
                </div>
              </div>
            )}

          {view === 'chats' &&
            chatInboxTab === 'visitor' &&
            activeId &&
            messages.map((msg, index) => {
              const isUser = msg.sender === 'user'
              const isAdmin = msg.sender === 'admin'
              const isAi = msg.sender === 'ai'
              return (
                <div
                  key={msg.id ?? `m-${index}`}
                  className={`mb-4 flex ${isUser ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="min-w-0 max-w-[min(94%,34rem)] sm:max-w-[72%]">
                    {isAdmin && msg.admin_name && (
                      <p className="mb-1 text-right text-[10px] font-semibold text-[color:var(--admin-accent)]">
                        {msg.admin_name}
                      </p>
                    )}
                    {isAi && (
                      <p className="mb-1 text-right text-[10px] font-bold uppercase tracking-wide text-[color:var(--admin-accent)]">
                        AI
                      </p>
                    )}
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isUser
                          ? 'rounded-tl-md border border-slate-200/90 bg-white text-slate-900 shadow-sm'
                          : isAdmin
                            ? 'rounded-tr-md bg-[color:var(--admin-accent)] text-white shadow-md shadow-blue-500/15'
                            : 'rounded-tr-md border border-[var(--admin-ai-border)] bg-[var(--admin-ai-bg)] text-[var(--admin-ai-text)]'
                      }`}
                    >
                      {msg.content}
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] tabular-nums text-[color:var(--admin-muted-2)] ${
                        isUser ? 'pl-1' : 'pr-1 text-right'
                      }`}
                    >
                      {fmtDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })}

          {view === 'chats' &&
            chatInboxTab === 'borrower' &&
            activeBorrowerLeadId &&
            borrowerMessages.map((msg, index) => {
              const isBorrower = msg.sender_type === 'borrower'
              return (
                <div
                  key={msg.id ?? `bm-${index}`}
                  className={`mb-4 flex ${isBorrower ? 'justify-start' : 'justify-end'}`}
                >
                  <div className="min-w-0 max-w-[min(94%,34rem)] sm:max-w-[72%]">
                    {!isBorrower && msg.admin_name ? (
                      <p className="mb-1 text-right text-[10px] font-semibold text-[color:var(--admin-accent)]">
                        {msg.admin_name}
                      </p>
                    ) : null}
                    <div
                      className={`whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                        isBorrower
                          ? 'rounded-tl-md border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text)]'
                          : 'rounded-tr-md bg-[color:var(--admin-accent)] text-white'
                      }`}
                    >
                      {msg.message ? <p>{msg.message}</p> : null}
                      {msg.attachment_url ? (
                        <a
                          href={msg.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-1 block text-xs underline ${isBorrower ? 'text-[color:var(--admin-accent)]' : 'text-white/90'}`}
                        >
                          {msg.attachment_name || 'Attachment'}
                        </a>
                      ) : null}
                    </div>
                    <p
                      className={`mt-1 text-[10px] text-[color:var(--admin-muted-2)] ${
                        isBorrower ? 'pl-1' : 'pr-1 text-right'
                      }`}
                    >
                      {msg.created_at ? fmtDate(msg.created_at) : ''}
                    </p>
                  </div>
                </div>
              )
            })}

        </div>

        {/* Reply input */}
        {view === 'chats' &&
          chatInboxTab === 'visitor' &&
          activeId &&
          activeConvo?.status !== 'resolved' &&
          activeConvo?.status !== 'archived' && (
            <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_0_rgba(15,23,42,0.06)] backdrop-blur sm:px-3">
              <div className="w-full min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-sm sm:p-3">
                <div className="mb-2.5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <p className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Quick replies
                  </p>
                  <div className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                    {FAQ_QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() =>
                          setInput((prev) => (prev && !prev.endsWith('\n') ? `${prev}\n` : prev) + q)
                        }
                        className="min-h-[2.25rem] w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                        title={q}
                      >
                        {q.length > 72 ? `${q.slice(0, 70)}…` : q}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 items-end gap-2">
                  <div className="relative min-w-0 flex-1">
                    <div className="rounded-lg border border-slate-200 bg-white shadow-sm transition focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your reply…"
                        rows={2}
                        className="w-full min-h-[2.5rem] resize-y bg-transparent px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
                      />
                    </div>
                    {showEmojiPicker ? (
                      <div className="absolute bottom-full left-0 z-20 mb-1 flex max-w-[min(100vw-2rem,20rem)] flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                        {['😀', '🙂', '👍', '🙏', '💰', '📎', '✅', '❤️'].map((e) => (
                          <button
                            key={e}
                            type="button"
                            className="rounded p-1 text-lg hover:bg-slate-50"
                            onClick={() => {
                              setInput((prev) => prev + e)
                              setShowEmojiPicker(false)
                            }}
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      title="Insert emoji"
                      onClick={() => setShowEmojiPicker((v) => !v)}
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <circle cx="12" cy="12" r="9" />
                        <path strokeLinecap="round" d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
                      title="Attach file (preview)"
                      onClick={() =>
                        window.alert('File upload: connect multipart endpoint + virus scan in production.')
                      }
                    >
                      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.657 18.217a6 6 0 108.486-8.486L7.757 10.657" />
                      </svg>
                    </button>
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--admin-accent)] text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <svg
                        className="h-[17px] w-[17px]"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {view === 'chats' && chatInboxTab === 'borrower' && activeBorrowerLeadId && (
          <div className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-8px_24px_0_rgba(15,23,42,0.06)] backdrop-blur sm:px-3">
            <div className="w-full min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/90 p-2.5 shadow-sm sm:p-3">
              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <p className="shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Reply to borrower
                </p>
                <div className="grid w-full min-w-0 grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                  {FAQ_QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() =>
                        setBorrowerInput((prev) => (prev && !prev.endsWith('\n') ? `${prev}\n` : prev) + q)
                      }
                      className="min-h-[2.25rem] w-full truncate rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-[11px] font-medium leading-snug text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
                      title={q}
                    >
                      {q.length > 72 ? `${q.slice(0, 70)}…` : q}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex min-w-0 items-end gap-2">
                <div className="relative min-w-0 flex-1">
                  <div className="rounded-lg border border-slate-200 bg-white shadow-sm transition focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200">
                    <textarea
                      value={borrowerInput}
                      onChange={(e) => setBorrowerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          sendBorrowerReply()
                        }
                      }}
                      placeholder="Type your reply to the borrower…"
                      rows={2}
                      className="w-full min-h-[2.5rem] resize-y bg-transparent px-3 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={sendBorrowerReply}
                  disabled={borrowerSending || !borrowerInput.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--admin-accent)] text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send to borrower"
                >
                  <svg className="h-[17px] w-[17px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'chats' && chatInboxTab === 'visitor' && activeConvo?.status === 'resolved' && (
          <div className="border-t border-emerald-500/25 bg-emerald-500/10 px-5 py-3 text-center text-sm text-emerald-300">
            This conversation has been resolved.
            <button
              onClick={() => changeStatus(activeId, 'open')}
              className="ml-2 font-semibold underline"
            >
              Reopen
            </button>
          </div>
        )}

        {view === 'chats' && chatInboxTab === 'visitor' && activeConvo?.status === 'archived' && (
          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-2)] px-5 py-3 text-center text-sm text-[color:var(--admin-muted)]">
            This conversation has been archived.
            <button
              onClick={() => changeStatus(activeId, 'open')}
              className="ml-2 font-semibold underline"
            >
              Reopen
            </button>
          </div>
        )}
        </div>

        {crmProfileOpen && view === 'chats' && chatInboxTab === 'borrower' && activeBorrowerLead ? (
          <aside className="flex max-h-[min(100dvh,900px)] w-full shrink-0 flex-col overflow-y-auto border-t border-[var(--admin-border)] bg-[var(--admin-surface-2)] lg:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0">
            <div className="border-b border-[var(--admin-border)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-muted)]">
                Borrower (portal chat)
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--admin-text)]">
                {activeBorrowerLead.name || 'Borrower'}
              </p>
              <p className="break-words text-xs text-[color:var(--admin-muted-2)]">
                {activeBorrowerLead.email || 'No email'} · Lead #{activeBorrowerLead.id}
              </p>
              <p className="mt-2 text-[11px] text-[color:var(--admin-muted-2)]">
                Thread type: {activeBorrowerLead.loan_type || BORROWER_CHAT_LOAN_TYPE}. Messages sync with the borrower
                portal Chat page.
              </p>
              {canViewBorrowers && activeBorrowerLead.user_id ? (
                <Link
                  to={`/admin/borrowers/${activeBorrowerLead.user_id}`}
                  className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-[color:var(--admin-accent)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Open full borrower profile
                </Link>
              ) : (
                <p className="mt-2 text-[10px] text-[color:var(--admin-muted-2)]">
                  Borrower account link appears after the lead is tied to a user (same email as portal login).
                </p>
              )}
            </div>
            <div className="space-y-3 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-[color:var(--admin-muted)]">Lead status</p>
                <select
                  value={activeBorrowerLead.status}
                  onChange={(e) => updateLeadStatusById(activeBorrowerLead.id, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1.5 text-xs"
                >
                  {Object.entries(LEAD_STATUS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </aside>
        ) : null}

        {crmProfileOpen && view === 'chats' && chatInboxTab === 'visitor' && activeConvo ? (
          <aside className="flex max-h-[min(100dvh,900px)] w-full shrink-0 flex-col overflow-y-auto border-t border-[var(--admin-border)] bg-[var(--admin-surface-2)] lg:max-h-none lg:w-[22rem] lg:border-l lg:border-t-0">
            <div className="border-b border-[var(--admin-border)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--admin-muted)]">
                Customer profile
              </p>
              <p className="mt-1 text-sm font-semibold text-[var(--admin-text)]">
                {displayName(activeConvo)}
              </p>
              <p className="break-words text-xs text-[color:var(--admin-muted-2)]">
                {activeConvo.visitor_email || 'No email on file'} · Ref{' '}
                {activeConvo.id != null ? shortConversationRef(activeConvo.id) : '—'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-500/25">
                  {activeConvo.mode === 'human' ? 'Human-handled' : 'AI-handled'}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_BADGE[activeConvo.status]}`}
                >
                  {STATUS_LABEL[activeConvo.status]}
                </span>
                <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-500/20">
                  SLA: ~3m first reply (mock)
                </span>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3 text-sm">
              <div>
                <p className="text-[11px] font-semibold text-[color:var(--admin-muted)]">Lead / loan interest</p>
                <p className="mt-0.5 text-[color:var(--admin-muted-2)]">
                  Capture from chat or convert — stored in CRM leads when visitors submit the lead form.
                </p>
              </div>
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
                <p className="text-[11px] font-semibold text-[color:var(--admin-muted)]">Lending (preview)</p>
                <ul className="mt-2 space-y-1.5 text-xs text-[color:var(--admin-muted-2)]">
                  <li>Active loans: link when borrower matched (Laravel API)</li>
                  <li>Pending applications: from Apply flow</li>
                </ul>
                {canManageLoans ? (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-lg bg-[color:var(--admin-accent)] px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                    onClick={() =>
                      window.alert(
                        'Approve loan: wire to Laravel POST /loan-applications/:id/approve when backend is connected.',
                      )
                    }
                  >
                    Approve loan (integration)
                  </button>
                ) : null}
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[color:var(--admin-muted)]">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {['Borrower', 'Prospect'].map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--admin-text)]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[color:var(--admin-muted)]" htmlFor="crm-internal-notes">
                  Internal notes (admin-only)
                </label>
                <textarea
                  id="crm-internal-notes"
                  rows={4}
                  value={internalNotes}
                  onChange={(e) => persistInternalNotes(e.target.value)}
                  placeholder="Notes visible only to your team…"
                  className="mt-1 w-full resize-none rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-xs text-[var(--admin-text)] outline-none focus:ring-2 focus:ring-[color:var(--admin-accent)]/20"
                />
              </div>
              <p className="text-[10px] text-[color:var(--admin-muted-2)]">
                Real-time: Socket.IO active. Laravel Echo / Pusher can subscribe to the same events when you add a
                broadcast bridge.
              </p>
            </div>
          </aside>
        ) : null}
      </div>

      {/* Create ticket modal */}
      {ticketModal && ticketModal.conversation_id && !ticketModal.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">
              Create support ticket
            </h3>
            <p className="mt-2 text-sm text-[color:var(--admin-muted)]">
              Create a ticket for this conversation.
            </p>
            <div className="mt-4">
              <p className="text-xs text-[color:var(--admin-muted-2)]">
                Conversation: {ticketModal.conversation_id}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setTicketModal(null)}
                className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                onClick={() => createTicketForConvo(ticketModal.conversation_id)}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ backgroundColor: 'var(--brand-primary, #2F6FA3)' }}
              >
                Create ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete conversation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">
              Delete conversation
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--admin-muted)]">
              Permanently delete this conversation and all its messages? This cannot
              be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email lead (SMTP via Laravel) */}
      {leadEmailModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-email-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <h3 id="lead-email-title" className="text-lg font-semibold text-[var(--admin-text)]">
              Email lead
            </h3>
            <p className="mt-1 text-sm text-[color:var(--admin-muted)]">
              To:{' '}
              <span className="font-medium text-[var(--admin-text)]">
                {leadEmailModal.email || '—'}
              </span>
              {leadEmailModal.name ? ` (${leadEmailModal.name})` : ''}
            </p>
            {leadEmailError ? (
              <p
                className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-800 dark:text-rose-200"
                role="alert"
              >
                {leadEmailError}
              </p>
            ) : null}
            <label htmlFor="lead-email-subject" className="mt-4 block text-xs font-medium text-[color:var(--admin-muted)]">
              Subject
            </label>
            <input
              id="lead-email-subject"
              type="text"
              value={leadEmailSubject}
              onChange={(e) => setLeadEmailSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-text)]"
            />
            <label htmlFor="lead-email-body" className="mt-3 block text-xs font-medium text-[color:var(--admin-muted)]">
              Message
            </label>
            <textarea
              id="lead-email-body"
              value={leadEmailBody}
              onChange={(e) => setLeadEmailBody(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 py-2 text-sm text-[var(--admin-text)]"
            />
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setLeadEmailModal(null)
                  setLeadEmailError('')
                }}
                className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  leadEmailSending ||
                  !String(leadEmailModal.email || '').trim() ||
                  !leadEmailSubject.trim() ||
                  !leadEmailBody.trim()
                }
                onClick={sendLeadEmail}
                className="flex-1 rounded-lg bg-[color:var(--admin-accent)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {leadEmailSending ? 'Sending…' : 'Send email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete feedback modal */}
      {deleteFeedbackTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[var(--admin-text)]">
              Delete feedback
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[color:var(--admin-muted)]">
              Permanently delete this feedback submission? This cannot be undone.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteFeedbackTarget(null)}
                className="flex-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--admin-muted)] transition hover:bg-[var(--admin-surface-2)] hover:text-[var(--admin-text)]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteFeedback}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

