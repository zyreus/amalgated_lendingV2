import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Paperclip, SendHorizonal } from 'lucide-react'
import { borrowerApi } from '../api/client.js'
import { SkeletonLine } from '../../components/AppSkeletons.jsx'
import {
  AlertBanner,
  ChatMessageBubble,
  SupportInfoPanel,
} from '../components/SupportUi.jsx'
import { scrollChatToBottom, sortChatMessagesChronological } from '../../utils/chatMessageOrder.js'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function BorrowerChatPage() {
  const [searchParams] = useSearchParams()
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  const canSend = useMemo(() => Boolean(text.trim() || file), [text, file])

  const formattedMessages = useMemo(
    () =>
      sortChatMessagesChronological(messages).map((m) => ({
        ...m,
        timeLabel: formatTime(m.created_at),
      })),
    [messages],
  )

  const scrollToBottom = (behavior = 'auto') => {
    scrollChatToBottom(listRef, behavior)
  }

  const loadMessages = async () => {
    try {
      const res = await borrowerApi('/borrower/chat/messages')
      setMessages(sortChatMessagesChronological(res.data || []))
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to load chat messages.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = (searchParams.get('q') || '').trim()
    if (q) setText(q)
  }, [searchParams])

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (!mounted) return
      await loadMessages()
    }
    run()
    const iv = setInterval(() => {
      if (!mounted) return
      if (typeof document !== 'undefined' && document.hidden) return
      loadMessages()
    }, 6000)
    return () => {
      mounted = false
      clearInterval(iv)
    }
  }, [])

  useEffect(() => {
    scrollToBottom(loading ? 'auto' : 'smooth')
  }, [formattedMessages, loading])

  const send = async () => {
    if (!canSend) return
    setSending(true)
    setError('')
    try {
      const body = new FormData()
      if (text.trim()) body.append('message', text.trim())
      if (file) body.append('attachment', file)
      await borrowerApi('/borrower/chat/messages', {
        method: 'POST',
        body,
      })
      setText('')
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadMessages()
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
      scrollToBottom('smooth')
    }
  }

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Support</p>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">Live chat</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Message our team for account help, loan concerns, or payment follow-up.
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
      >
        <div className="grid lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
          <div className="hidden border-r border-gray-100 bg-gradient-to-b from-red-50/50 to-white dark:border-[#1F2937] dark:from-red-950/20 dark:to-[#111827] lg:block">
            <SupportInfoPanel onQuickPrompt={setText} />
          </div>

          <div className="flex min-h-[520px] flex-col">
            <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-5 py-4 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-6">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-primary">Conversation</p>
              <h2 className="mt-0.5 text-base font-semibold text-gray-900 dark:text-gray-100">Chat with support</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Messages refresh automatically. Enter to send, Shift+Enter for a new line.
              </p>
            </div>

            <div className="flex flex-1 flex-col px-5 py-4 sm:px-6">
              {error ? (
                <div className="mb-3">
                  <AlertBanner type="error">{error}</AlertBanner>
                </div>
              ) : null}

              <div
                ref={listRef}
                className="flex min-h-[280px] flex-1 flex-col space-y-3 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40"
              >
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 ${i % 2 ? 'ml-auto' : ''}`}>
                        <SkeletonLine className="h-3 w-48 max-w-full" />
                      </div>
                    ))}
                  </div>
                ) : null}

                {!loading && formattedMessages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex h-full min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center dark:border-[#374151] dark:bg-[#0b1323]"
                  >
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Start the conversation</p>
                    <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">
                      Choose a quick prompt below or type your message. Our support team will respond here.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2 lg:hidden">
                      {['Payment help', 'Application status', 'Upload issue'].map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setText(prompt)}
                          className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-300"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                ) : null}

                {formattedMessages.map((m) => (
                  <ChatMessageBubble key={m.id} message={m} isBorrower={m.sender_type === 'borrower'} />
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-[#1F2937] dark:bg-[#0F172A]/30">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  rows={3}
                  placeholder="Type your message…"
                  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100"
                />

                {file ? (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-300">
                    <span className="truncate">Attached: {file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="shrink-0 font-medium text-brand-primary hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition hover:border-gray-300 dark:border-[#374151] dark:bg-[#111827] dark:text-gray-300"
                    >
                      <Paperclip className="size-3.5" />
                      Attach file
                    </button>
                    <Link
                      to="/borrower/tickets"
                      className="text-xs font-medium text-gray-500 transition hover:text-brand-primary dark:text-gray-400"
                    >
                      Open ticket instead
                    </Link>
                  </div>
                  <button
                    onClick={send}
                    disabled={sending || !canSend}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? 'Sending…' : 'Send'}
                    <SendHorizonal className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
