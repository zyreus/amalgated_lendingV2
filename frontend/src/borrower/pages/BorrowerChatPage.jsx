import { useEffect, useMemo, useRef, useState } from 'react'
import { borrowerApi } from '../api/client.js'
import { SkeletonLine } from '../../components/AppSkeletons.jsx'

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function BorrowerChatPage() {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const fileInputRef = useRef(null)

  const canSend = useMemo(() => Boolean(text.trim() || file), [text, file])

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      const el = listRef.current
      if (!el) return
      el.scrollTop = el.scrollHeight
    })
  }

  const loadMessages = async () => {
    try {
      const res = await borrowerApi('/borrower/chat/messages')
      setMessages(res.data || [])
    } catch (err) {
      setError(err.message || 'Failed to load chat messages.')
    } finally {
      setLoading(false)
    }
  }

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
    scrollToBottom()
  }, [messages, loading])

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
      await loadMessages()
    } catch (err) {
      setError(err.message || 'Failed to send message.')
    } finally {
      setSending(false)
    }
    setText('')
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    scrollToBottom()
  }

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="w-full min-w-0 rounded-2xl border border-gray-200 bg-white shadow-sm transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827] dark:shadow-lg">
      <div className="border-b border-gray-200 px-5 py-4 dark:border-[#1F2937]">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Chat Support</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Message an admin for account help, loan concerns, or payment follow-up.
        </p>
      </div>

      <div className="px-5 pb-5 pt-4">
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div
        ref={listRef}
        className="max-h-[26rem] space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3 transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#0F172A]/60"
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

        {!loading && messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center dark:border-[#374151] dark:bg-[#0b1323]">
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">No messages yet</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Start a chat and our support team will respond here.
            </p>
          </div>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm ${
              m.sender_type === 'borrower'
                ? 'ml-auto rounded-tr-md bg-red-100 text-red-900 dark:bg-red-600/20 dark:text-gray-100'
                : 'rounded-tl-md bg-white text-gray-800 shadow-sm ring-1 ring-gray-200 dark:bg-[#1F2937] dark:text-gray-200 dark:ring-[#374151]'
            }`}
          >
            {m.message ? <p>{m.message}</p> : null}
            {m.attachment_url ? (
              <a
                href={m.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-red-600 underline dark:text-red-300"
              >
                {m.attachment_name || 'View attachment'}
              </a>
            ) : null}
            <p
              className={`mt-1 text-[10px] ${
                m.sender_type === 'borrower'
                  ? 'text-right text-red-700/80 dark:text-red-200/80'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {formatTime(m.created_at)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-[#1F2937] dark:bg-[#0b1323]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onComposerKeyDown}
          rows={2}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-200 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:focus:border-red-500/50 dark:focus:ring-red-500/20"
        />

        {file ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-300">
            <span className="truncate">Attached: {file.name}</span>
            <button
              type="button"
              onClick={() => {
                setFile(null)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="shrink-0 font-medium text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
            >
              Remove
            </button>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="max-w-xs text-xs text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-gray-700 hover:file:bg-gray-200 dark:text-gray-400 dark:file:bg-[#1F2937] dark:file:text-gray-200 dark:hover:file:bg-[#374151]"
          />
          <button
            onClick={send}
            disabled={sending || !canSend}
            type="button"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
      </div>
    </div>
  )
}
