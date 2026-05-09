import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { adminSocketUrls, publicChatFetch } from '../utils/adminChatApi.js'
import { laravelRequest, publicLaravelPost } from '../utils/lendingLaravelApi.js'
import VisitorChatStatusDot from './lending-chat/VisitorChatStatusDot.jsx'
import VisitorConnectionWaitBanner from './lending-chat/VisitorConnectionWaitBanner.jsx'
import VisitorStreamTypingIndicator from './lending-chat/VisitorStreamTypingIndicator.jsx'

const QUICK_OPTIONS = [
  { id: 'apply', label: 'How to apply?', icon: '📝' },
  { id: 'rates', label: 'Ask about rates', icon: '💰' },
  { id: 'products', label: 'Loan products', icon: '📋' },
  { id: 'agent', label: 'Talk to an agent', icon: '👤' },
]
const CHAT_TIME_ZONE = 'Asia/Manila'
/** HTTP fallback when Socket.IO is down; keep conservative to avoid hammering Laravel. */
const CHAT_SYNC_POLL_MS = 8000
const CHAT_SYNC_POLL_WHEN_CONNECTED_MS = 4000

function detectLang() {
  const nav = typeof navigator !== 'undefined' ? navigator.language : ''
  const base = String(nav || '').toLowerCase().split(/[-_]/)[0]
  if (base === 'tl' || base === 'fil') return 'fil'
  if (['en', 'es'].includes(base)) return base
  return 'en'
}

function newConvoId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `lending-${crypto.randomUUID()}`
    } catch {
      /* ignore */
    }
  }
  return `lending-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function getConvoId() {
  try {
    const key = 'al_lending_convo_id'
    const current = localStorage.getItem(key) || sessionStorage.getItem(key)
    if (current) return current
    const next = newConvoId()
    localStorage.setItem(key, next)
    sessionStorage.setItem(key, next)
    return next
  } catch {
    return newConvoId()
  }
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: CHAT_TIME_ZONE })
}

function normalizeChatMessage(message) {
  const createdAt = message?.created_at || message?.time || new Date().toISOString()
  let sender = message?.sender
  if (!sender && message?.sender_type) {
    const st = String(message.sender_type).toLowerCase()
    if (st === 'customer' || st === 'visitor' || st === 'user') sender = 'user'
    else sender = message.sender_type
  }
  if (!sender) sender = 'ai'

  return {
    ...message,
    content: message?.content ?? message?.message ?? '',
    created_at: createdAt,
    time: createdAt,
    sender,
  }
}

function messageStableKey(message) {
  const idStr = message?.id != null && message.id !== '' ? String(message.id) : ''
  const volatile =
    idStr.startsWith('tmp-') ||
    idStr.startsWith('stream-') ||
    idStr.startsWith('t-') ||
    idStr.startsWith('laravel-')
  if (idStr && !volatile && /^\d+$/.test(idStr)) return `id:${idStr}`
  const sid = message?.conversation_id || message?.session_id || ''
  const body = String(message?.content || message?.message || '').slice(0, 240)
  return `fp:${sid}|${String(message?.sender || '')}|${body}|${String(message?.created_at || message?.time || '')}`
}

function mergeMessages(prev, incomingRows) {
  const all = [...prev.map((m) => normalizeChatMessage(m)), ...incomingRows.map((m) => normalizeChatMessage(m))]
  const byKey = new Map()
  all.forEach((m) => {
    byKey.set(messageStableKey(m), m)
  })
  return Array.from(byKey.values()).sort((a, b) => {
    const ta = new Date(a.created_at || a.time || 0).getTime()
    const tb = new Date(b.created_at || b.time || 0).getTime()
    if (ta !== tb) return ta - tb
    return String(a.id || '').localeCompare(String(b.id || ''))
  })
}

export default function LendingChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('al_lending_chat_lang') || detectLang()
    } catch {
      return detectLang()
    }
  })
  const [unread, setUnread] = useState(0)
  const [leadCapture, setLeadCapture] = useState(null)
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', company: '' })
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, name: '', email: '', subject: '', comment: '' })
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackNotice, setFeedbackNotice] = useState('')
  const [feedbackError, setFeedbackError] = useState('')
  const [agentStep, setAgentStep] = useState(null)
  const [agentForm, setAgentForm] = useState({ name: '', email: '', concern: '' })
  const [socketConnected, setSocketConnected] = useState(false)
  /** True after user send until first streamed token or non-stream AI message. */
  const [streamPending, setStreamPending] = useState(false)
  const [conversationMeta, setConversationMeta] = useState(null)

  const socketRef = useRef(null)
  const convoId = useRef(getConvoId())
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const openRef = useRef(open)
  const streamMessageByIdRef = useRef(new Map())
  const lastPersistedMessageIdRef = useRef(0)
  const recentUserSendsRef = useRef([])

  const shouldIgnoreUserEcho = useCallback((msg) => {
    if (!msg || msg.sender !== 'user') return false
    const content = String(msg.content || '').trim()
    if (!content) return false
    const now = Date.now()
    const windowMs = 2500
    const recent = Array.isArray(recentUserSendsRef.current) ? recentUserSendsRef.current : []
    // Keep only a small window of recent sends.
    const next = recent.filter((r) => r && now - (r.t || 0) <= windowMs)
    recentUserSendsRef.current = next
    return next.some((r) => r && r.content === content)
  }, [])

  const sourcePage = useMemo(
    () => (typeof window !== 'undefined' ? window.location.pathname || '/' : '/'),
    [],
  )

  const loadConversationMeta = useCallback(async (sessionId) => {
    const sid = String(sessionId || '').trim()
    if (!sid) return
    try {
      const { res } = await laravelRequest(`/public/chat/conversation-meta/${encodeURIComponent(sid)}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res?.ok) return
      const payload = await res.json().catch(() => ({}))
      setConversationMeta(payload?.data || null)
    } catch {
      /* ignore */
    }
  }, [])

  const loadPersistedMessages = useCallback(async (sessionId, options = {}) => {
    const sid = String(sessionId || '').trim()
    if (!sid) return
    const afterId = Math.max(Number(options?.afterId) || 0, 0)
    const query = new URLSearchParams()
    if (afterId > 0) query.set('after_id', String(afterId))
    query.set('limit', afterId > 0 ? '80' : '120')
    const suffix = query.size ? `?${query.toString()}` : ''
    try {
      const { res } = await laravelRequest(`/public/chat/messages/${encodeURIComponent(sid)}${suffix}`, {
        headers: { Accept: 'application/json' },
      })
      if (!res?.ok) return
      const data = await res.json().catch(() => ({}))
      const rows = Array.isArray(data?.data) ? data.data : []
      if (!rows.length) return
      for (const row of rows) {
        const id = Number(row?.id)
        if (Number.isFinite(id) && id > lastPersistedMessageIdRef.current) {
          lastPersistedMessageIdRef.current = id
        }
      }
      setMessages((prev) => mergeMessages(prev, rows))
    } catch {
      /* ignore */
    }
  }, [])

  const resetChat = useCallback(() => {
    const next = newConvoId()
    try {
      localStorage.setItem('al_lending_convo_id', next)
      sessionStorage.setItem('al_lending_convo_id', next)
    } catch {
      /* ignore */
    }
    convoId.current = next
    lastPersistedMessageIdRef.current = 0
    setMessages([])
    setInput('')
    setTyping(false)
    setLeadCapture(null)
    setLeadForm({ name: '', email: '', phone: '', company: '' })
    setFeedbackForm({ rating: 0, name: '', email: '', comment: '' })
    setFeedbackSubmitting(false)
    setFeedbackNotice('')
    setFeedbackError('')
    setShowFeedback(false)
    setAgentStep(null)
    setAgentForm({ name: '', email: '', concern: '' })
    setStreamPending(false)
    setConversationMeta(null)
    socketRef.current?.emit('visitor:join', {
      conversationId: next,
      source_page: sourcePage,
      lang,
    })
    loadPersistedMessages(next, { afterId: 0 })
    loadConversationMeta(next)
  }, [sourcePage, lang, loadPersistedMessages, loadConversationMeta])

  useEffect(() => {
    if (!open) return undefined
    const sid = convoId.current
    loadConversationMeta(sid)
    const iv = setInterval(() => loadConversationMeta(sid), 20000)
    return () => clearInterval(iv)
  }, [open, loadConversationMeta])

  useEffect(() => {
    let disposed = false
    let currentSocket = null
    const targets = adminSocketUrls()

    const attachSharedHandlers = (socket) => {
      socket.on('chat:history', (rows) => {
        if (!Array.isArray(rows)) return
        setMessages((prev) => mergeMessages(prev, rows))
      })

      socket.on('chat:message', (msg) => {
        if (shouldIgnoreUserEcho(msg)) return
        setMessages((prev) => mergeMessages(prev, [msg]))
        const fromAssistant = msg?.sender === 'ai' || msg?.sender === 'admin' || msg?.sender === 'system'
        if (fromAssistant) {
          setStreamPending(false)
        }
        setTyping(false)
        if (!openRef.current && msg.sender !== 'user') setUnread((n) => n + 1)
      })

      socket.on('chat:typing', () => setTyping(true))
      socket.on('chat:typingStop', () => setTyping(false))
      socket.on('chat:streamStart', (event) => {
        const streamId = event?.stream_id
        if (!streamId) return
        const tempId = `stream-${streamId}`
        streamMessageByIdRef.current.set(streamId, tempId)
        setMessages((prev) =>
          mergeMessages(prev, [
            {
              id: tempId,
              sender: 'ai',
              content: '',
              created_at: event?.created_at || new Date().toISOString(),
            },
          ]),
        )
      })
      socket.on('chat:streamDelta', (event) => {
        const streamId = event?.stream_id
        const delta = String(event?.delta || '')
        if (!streamId || !delta) return
        const messageId = streamMessageByIdRef.current.get(streamId)
        if (!messageId) return
        setStreamPending(false)
        setTyping(false)
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, content: `${m.content || ''}${delta}` } : m)),
        )
      })
      socket.on('chat:streamEnd', (event) => {
        const streamId = event?.stream_id
        if (!streamId) return
        const messageId = streamMessageByIdRef.current.get(streamId)
        streamMessageByIdRef.current.delete(streamId)
        if (!messageId) return
        const finalContent = String(event?.content || '')
        setStreamPending(false)
        setTyping(false)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? normalizeChatMessage({
                  ...m,
                  sender: 'ai',
                  content: finalContent || m.content || '',
                  created_at: event?.created_at || m.created_at || new Date().toISOString(),
                })
              : m,
          ),
        )
      })
      socket.on('chat:requestLeadDetails', ({ inquiry_message }) => {
        setLeadCapture({ inquiry_message: inquiry_message || '' })
        setLeadForm({ name: '', email: '', phone: '', company: '' })
      })
      socket.on('chat:leadCaptured', () => {
        setLeadCapture(null)
        setLeadForm({ name: '', email: '', phone: '', company: '' })
      })
      socket.on('disconnect', () => setSocketConnected(false))
      socket.on('chat:expectNoAiStream', () => {
        setStreamPending(false)
        setTyping(false)
      })
      socket.on('chat:error', () => {
        setStreamPending(false)
        setTyping(false)
      })
    }

    const connectWithFallback = (index) => {
      if (disposed || index >= targets.length) return
      const target = targets[index]
      const socket = io(target, { autoConnect: false, transports: ['websocket', 'polling'] })
      currentSocket = socket
      socketRef.current = socket

      attachSharedHandlers(socket)
      socket.on('connect', () => {
        if (disposed) return
        setSocketConnected(true)
        socket.emit('visitor:join', { conversationId: convoId.current, source_page: sourcePage, lang })
      })
      socket.on('connect_error', () => {
        if (disposed) return
        setSocketConnected(false)
        socket.removeAllListeners()
        socket.disconnect()
        connectWithFallback(index + 1)
      })

      socket.connect()
    }

    connectWithFallback(0)
    return () => {
      disposed = true
      currentSocket?.removeAllListeners()
      currentSocket?.disconnect()
    }
  }, [lang, sourcePage])

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!open) return
    setUnread(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing, streamPending, leadCapture, showFeedback])

  useEffect(() => {
    try {
      localStorage.setItem('al_lending_chat_lang', lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  useEffect(() => {
    loadPersistedMessages(convoId.current, { afterId: 0 })
  }, [loadPersistedMessages])

  // Keep chatbot <-> CRM in sync even if a socket event is dropped or relay env is misconfigured.
  useEffect(() => {
    const tick = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      loadPersistedMessages(convoId.current, { afterId: lastPersistedMessageIdRef.current })
    }
    const id = setInterval(
      tick,
      socketConnected ? CHAT_SYNC_POLL_WHEN_CONNECTED_MS : CHAT_SYNC_POLL_MS,
    )
    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick()
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis)
    }
    return () => {
      clearInterval(id)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis)
      }
    }
  }, [loadPersistedMessages, socketConnected])

  const sendMessage = useCallback(
    async (textInput = input) => {
      const text = String(textInput || '').trim()
      if (!text) return
      const outboundDedupeKey =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const optimistic = normalizeChatMessage({
        id: tempId,
        sender: 'user',
        content: text,
      })
      setMessages((prev) => [...prev, optimistic])
      try {
        const now = Date.now()
        const recent = Array.isArray(recentUserSendsRef.current) ? recentUserSendsRef.current : []
        recentUserSendsRef.current = [...recent.slice(-10), { content: text, t: now }]
      } catch {
        /* ignore */
      }
      const socketOk = !!socketRef.current?.connected
      setStreamPending(socketOk)

      setInput('')
      /** Same dedupe UUID as Socket.IO payload so Laravel upserts stay aligned with chat-server warehouse sync. */
      const warehouseSendBody = () => {
        const body = {
          session_id: convoId.current,
          visitor_id: convoId.current,
          message: text,
        }
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outboundDedupeKey)
        ) {
          body.dedupe_key = outboundDedupeKey
        }
        return body
      }
      if (socketOk) {
        const payload = {
          conversationId: convoId.current,
          content: text,
          source_page: sourcePage,
          lang,
        }
        if (
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(outboundDedupeKey)
        ) {
          payload.dedupe_key = outboundDedupeKey
        }
        socketRef.current.emit('visitor:message', payload)
        /**
         * Admin CRM inbox reads Laravel `chat_messages`, not Node. When warehouse sync env is missing/wrong,
         * mirroring here still creates the thread (AI lines continue to rely on Node → Laravel sync).
         */
        void (async () => {
          try {
            const data = await publicLaravelPost('/public/chat/send', warehouseSendBody())
            if (data?.message) {
              const persisted = normalizeChatMessage(data.message)
              const persistedId = Number(persisted?.id)
              if (Number.isFinite(persistedId) && persistedId > lastPersistedMessageIdRef.current) {
                lastPersistedMessageIdRef.current = persistedId
              }
              setMessages((prev) => prev.map((m) => (m.id === tempId ? persisted : m)))
            }
          } catch {
            /* Non-fatal: realtime path still works; staff may lack warehouse row until sync is configured */
          }
          await loadConversationMeta(convoId.current)
        })()
        return
      }

      /** HTTP-only path — message is stored for staff; AI streaming requires a live CRM socket. */
      setStreamPending(false)
      try {
        const data = await publicLaravelPost('/public/chat/send', warehouseSendBody())
        if (data?.message) {
          const persisted = normalizeChatMessage(data.message)
          const persistedId = Number(persisted?.id)
          if (Number.isFinite(persistedId) && persistedId > lastPersistedMessageIdRef.current) {
            lastPersistedMessageIdRef.current = persistedId
          }
          setMessages((prev) => prev.map((m) => (m.id === tempId ? persisted : m)))
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tempId))
      }
      await loadConversationMeta(convoId.current)
    },
    [input, lang, sourcePage, loadConversationMeta],
  )

  const handleQuickOption = useCallback(
    (id) => {
      if (id === 'agent') {
        setAgentStep('form')
        return
      }
      const prompts = {
        apply: 'How do I apply for a loan?',
        rates: 'Can you explain your rates and terms?',
        products: 'What loan products are available?',
      }
      sendMessage(prompts[id] || '')
    },
    [sendMessage],
  )

  const submitAgentRequest = useCallback(
    async (e) => {
      e.preventDefault()
      const name = agentForm.name.trim()
      const email = agentForm.email.trim()
      const concern = agentForm.concern.trim()
      if (!name || !email || !concern) return

      const payload = {
        conversationId: convoId.current,
        name,
        email,
        concern,
        source_page: sourcePage,
      }

      const agentIntro = `[Agent Request] Name: ${name} | Email: ${email} | Concern: ${concern}`
      let submitted = false
      if (socketRef.current?.connected) {
        socketRef.current.emit('visitor:requestAgent', payload)
        submitted = true
      }

      // Keep CRM queue connected to Laravel warehouse even when socket path fails.
      if (!submitted) {
        try {
          await publicLaravelPost('/public/chat/send', {
            session_id: convoId.current,
            visitor_id: convoId.current,
            message: agentIntro,
          })
          await publicLaravelPost('/public/leads', {
            name,
            email,
            organization: null,
            loan_type: 'Website Chat Agent Request',
            message: concern,
          })
          setMessages((prev) =>
            mergeMessages(prev, [
              {
                id: `local-agent-queue-${Date.now()}`,
                sender: 'system',
                content: "You've been connected to our support queue. A representative will be with you shortly.",
                created_at: new Date().toISOString(),
              },
            ]),
          )
          submitted = true
        } catch {
          submitted = false
        }
      }

      if (!submitted) return
      setAgentStep(null)
      setAgentForm({ name: '', email: '', concern: '' })
      await loadConversationMeta(convoId.current)
    },
    [agentForm, sourcePage, loadConversationMeta],
  )

  const submitLead = useCallback(
    async (e) => {
      e.preventDefault()
      const name = leadForm.name.trim()
      const email = leadForm.email.trim()
      if (!name || !email) return

      const payload = {
        conversationId: convoId.current,
        name,
        email,
        phone: leadForm.phone.trim(),
        company: leadForm.company.trim(),
        inquiry_message: leadCapture?.inquiry_message || '',
        source_page: sourcePage,
        lang,
      }

      let submitted = false
      if (socketRef.current?.connected) {
        socketRef.current.emit('visitor:leadDetails', payload)
        submitted = true
      }

      if (!submitted) {
        try {
          await publicLaravelPost('/public/leads', {
            name,
            email,
            organization: payload.company || null,
            loan_type: 'Website Chat Lead',
            message: payload.inquiry_message || 'Requested loan consultation via website chat.',
          })
          submitted = true
        } catch {
          submitted = false
        }
      }

      if (!submitted) return
      setLeadCapture(null)
      setLeadForm({ name: '', email: '', phone: '', company: '' })
    },
    [leadForm, leadCapture, sourcePage, lang],
  )

  const submitFeedback = useCallback(
    async (e) => {
      e.preventDefault()
      setFeedbackNotice('')
      setFeedbackError('')
      if (!feedbackForm.rating) {
        setFeedbackError('Please choose a star rating before submitting.')
        return
      }
      if (!feedbackForm.comment.trim()) {
        setFeedbackError('Please add your feedback comment.')
        return
      }
      setFeedbackSubmitting(true)
      try {
        const payload = {
          conversationId: convoId.current,
          rating: feedbackForm.rating,
          name: feedbackForm.name.trim() || 'Anonymous',
          email: feedbackForm.email.trim() || null,
          subject: feedbackForm.subject.trim() || null,
          comment: feedbackForm.comment.trim(),
        }

        let submitted = false
        let lastError = null

        // Prefer socket ack path for reliability in LAN/dev/proxied environments.
        if (socketRef.current?.connected) {
          try {
            const socketResult = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => reject(new Error('Feedback submit timed out.')), 4000)
              socketRef.current.emit('visitor:feedback', payload, (result) => {
                clearTimeout(timeout)
                resolve(result || { ok: false, message: 'Unable to submit feedback right now.' })
              })
            })
            if (socketResult?.ok) {
              submitted = true
            } else {
              lastError = new Error(socketResult?.message || 'Unable to submit feedback right now.')
            }
          } catch (err) {
            lastError = err
          }
        }

        // Always fallback to HTTP when socket path did not confirm success.
        if (!submitted) {
          const { res } = await publicChatFetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res?.ok) {
            submitted = true
          } else {
            try {
              await publicLaravelPost('/public/chat/feedback', {
                session_id: convoId.current,
                rating: feedbackForm.rating,
                name: feedbackForm.name.trim() || undefined,
                email: feedbackForm.email.trim() || undefined,
                subject: feedbackForm.subject.trim() || undefined,
                comment: feedbackForm.comment.trim(),
              })
              submitted = true
            } catch {
              const data = await res?.json?.().catch(() => ({}))
              throw new Error(data?.message || lastError?.message || 'Unable to submit feedback right now.')
            }
          }
        }

        if (!submitted) {
          throw new Error(lastError?.message || 'Unable to submit feedback right now.')
        }
        setFeedbackNotice('Thank you! Your feedback has been submitted.')
        setFeedbackForm({ rating: 0, name: '', email: '', subject: '', comment: '' })
        setShowFeedback(false)
      } catch (err) {
        setFeedbackError(err?.message || 'Unable to submit feedback right now.')
      } finally {
        setFeedbackSubmitting(false)
      }
    },
    [feedbackForm],
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6"
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
        {!open && unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[520px] w-[380px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-brand-primary/30 bg-white shadow-2xl sm:bottom-24 sm:right-6 sm:h-[560px]">
          <div className="flex items-center gap-2 border-b border-brand-primary/30 bg-brand-primary px-3 py-3 text-white">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={resetChat}
                className="rounded-md p-1 text-white/70 transition hover:bg-white/10 hover:text-white"
                title="Back to menu"
                aria-label="Back to menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>
            )}
            <img src="/amalgated-lending-logo.png" alt="" className="h-9 w-9 rounded-full bg-white/20 object-contain p-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Amalgated Lending Assistant</p>
              <p className="text-xs leading-snug text-white/70">
                {!socketConnected
                  ? 'Offline delivery — connects to staff inbox (enable chat server for AI streaming).'
                  : conversationMeta?.mode === 'human' || conversationMeta?.needs_human
                    ? 'Human support queue • AI standby off'
                    : 'AI Assistant • escalate to Human anytime'}
              </p>
            </div>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              disabled={!socketConnected}
              className="hidden rounded-lg bg-white/15 px-2 py-1 text-[11px] font-semibold text-white outline-none ring-1 ring-white/20 backdrop-blur disabled:opacity-50 sm:block"
              aria-label="Language"
            >
              <option value="en" className="text-slate-900">English</option>
              <option value="fil" className="text-slate-900">Filipino</option>
              <option value="es" className="text-slate-900">Espanol</option>
            </select>
            <VisitorChatStatusDot aiReady={socketConnected} />
          </div>

          <VisitorConnectionWaitBanner visible={!socketConnected} />

          <div className="chat-scrollbar flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <img src="/amalgated-lending-logo.png" alt="" className="h-16 w-16 rounded-full object-contain" />
                <div>
                  <p className="text-base font-semibold text-[#3A3F45]">Welcome to Amalgated Lending!</p>
                  <p className="mt-1 text-sm text-[#3A3F45]/80">How can we help you today?</p>
                </div>
                <div className="mt-2 flex w-full flex-col gap-2">
                  {QUICK_OPTIONS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-left text-sm font-medium text-brand-text transition hover:border-brand-primary/40 hover:bg-brand-primary/5"
                      onClick={() => handleQuickOption(o.id)}
                    >
                      <span className="text-lg">{o.icon}</span>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={`${m.id || i}`} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender === 'user'
                      ? 'rounded-br-md bg-brand-primary text-white'
                      : m.sender === 'admin'
                        ? 'rounded-bl-md border border-emerald-200 bg-emerald-50 text-[#3A3F45]'
                        : m.sender === 'system'
                          ? 'rounded-bl-md border border-amber-200 bg-amber-50 text-[#3A3F45]'
                          : 'rounded-bl-md border border-black/10 bg-[#F8F8F8] text-brand-text'
                  }`}
                >
                  {m.sender === 'admin' && m.admin_name && (
                    <p className="mb-1 text-[10px] font-semibold text-emerald-800/90">{m.admin_name}</p>
                  )}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${m.sender === 'user' ? 'text-white/60' : 'text-[#3A3F45]/40'}`}
                  >
                    {formatTime(m.time || m.created_at)}
                  </p>
                </div>
              </div>
            ))}

            <VisitorStreamTypingIndicator visible={streamPending || typing} />

            {leadCapture && (
              <form onSubmit={submitLead} className="w-full max-w-[90%] space-y-2.5 rounded-2xl rounded-bl-md border border-[#C9CED4]/30 bg-[#F4F6F8] p-4">
                <p className="text-xs text-[#3A3F45]/70">Share your details so we can follow up:</p>
                <input
                  type="text"
                  placeholder="Name *"
                  required
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="email"
                  placeholder="Email *"
                  required
                  value={leadForm.email}
                  onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="tel"
                  placeholder="Phone"
                  value={leadForm.phone}
                  onChange={(e) => setLeadForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={leadForm.company}
                  onChange={(e) => setLeadForm((f) => ({ ...f, company: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <button type="submit" className="w-full rounded-lg bg-brand-primary py-2 text-sm font-semibold text-white transition hover:bg-brand-primary-hover">
                  Submit
                </button>
              </form>
            )}

            {agentStep === 'form' && (
              <form onSubmit={submitAgentRequest} className="w-full max-w-[90%] space-y-2.5 rounded-2xl rounded-bl-md border border-[#C9CED4]/30 bg-[#F4F6F8] p-4">
                <p className="text-xs text-[#3A3F45]/70">Please share your details and concern so an agent can assist you.</p>
                <input
                  type="text"
                  placeholder="Your name *"
                  required
                  value={agentForm.name}
                  onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <input
                  type="email"
                  placeholder="Your email *"
                  required
                  value={agentForm.email}
                  onChange={(e) => setAgentForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <textarea
                  rows={2}
                  placeholder="What do you need help with? *"
                  required
                  value={agentForm.concern}
                  onChange={(e) => setAgentForm((f) => ({ ...f, concern: e.target.value }))}
                  className="w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-brand-text outline-none placeholder:text-black/50 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-lg bg-brand-primary py-2 text-sm font-semibold text-white transition hover:bg-brand-primary-hover">
                    Connect to agent
                  </button>
                  <button
                    type="button"
                    onClick={() => setAgentStep(null)}
                    className="rounded-lg border border-black/10 px-3 py-2 text-sm text-black/70 transition hover:bg-black/5"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {showFeedback && (
              <form onSubmit={submitFeedback} className="w-full max-w-[92%] space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:p-5">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-primary">Customer Feedback</p>
                  <p className="text-sm font-semibold text-slate-800">How would you rate your experience?</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFeedbackForm((f) => ({ ...f, rating: star }))}
                      className={`rounded-md p-0.5 text-2xl transition-transform hover:scale-110 ${feedbackForm.rating >= star ? 'text-amber-400' : 'text-slate-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600">Name (optional)</span>
                    <input
                      type="text"
                      placeholder="Your name"
                      value={feedbackForm.name}
                      onChange={(e) => setFeedbackForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs font-medium text-slate-600">Email (optional)</span>
                    <input
                      type="email"
                      placeholder="you@email.com"
                      value={feedbackForm.email}
                      onChange={(e) => setFeedbackForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                    />
                  </label>
                </div>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Subject (optional)</span>
                  <input
                    type="text"
                    placeholder="What is this about?"
                    value={feedbackForm.subject}
                    onChange={(e) => setFeedbackForm((f) => ({ ...f, subject: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-slate-600">Message</span>
                  <textarea
                    rows={4}
                    required
                    placeholder="Share your feedback..."
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm((f) => ({ ...f, comment: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                  />
                </label>
                {feedbackError && (
                  <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{feedbackError}</p>
                )}
                <button
                  type="submit"
                  disabled={feedbackSubmitting}
                  className="w-full rounded-lg bg-brand-primary py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {feedbackSubmitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </form>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-[#C9CED4]/30 bg-white px-3 py-3">
            <div className="mb-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAgentStep('form')}
                className="rounded-md border border-brand-primary/40 bg-brand-primary/5 px-2 py-1 text-xs font-medium text-brand-primary transition hover:bg-brand-primary/10"
              >
                Human agent
              </button>
              <button
                type="button"
                onClick={() => setShowFeedback((v) => !v)}
                className="rounded-md border border-black/10 px-2 py-1 text-xs text-black/70 transition hover:bg-black/5"
              >
                {showFeedback ? 'Hide Feedback' : 'Feedback'}
              </button>
            </div>
            {feedbackNotice && (
              <p className="mb-2 text-xs font-medium text-emerald-600">{feedbackNotice}</p>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Type your message..."
                className="max-h-24 flex-1 resize-none rounded-xl border border-black/10 bg-[#F8F8F8] px-4 py-2.5 text-sm text-brand-text outline-none transition placeholder:text-black/50 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:border-amber-200/80 disabled:bg-black/5 disabled:text-black/40"
              />
              <button
                type="button"
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-[#3A3F45]/40">
              {socketConnected
                ? 'Powered by Groq-backed AI • answers can be inaccurate'
                : 'Offline mode saves to lending staff queue — connect chat server for live AI streams'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}

