import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'

export const VISITOR_MESSAGE_LIMIT_OPTIONS = [5, 8, 10, 15]
export const DEFAULT_MAX_CONSECUTIVE_VISITOR_MESSAGES = 8
export const WEBSITE_CHAT_SETTING_KEY = 'website_chat'

export default function WebsiteChatVisitorLimitSettings({ compact = false }) {
  const { showToast } = useToast()
  const [maxLimit, setMaxLimit] = useState(DEFAULT_MAX_CONSECUTIVE_VISITOR_MESSAGES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api(`/settings/${WEBSITE_CHAT_SETTING_KEY}`)
        const value = res?.setting?.value || res?.settings?.[WEBSITE_CHAT_SETTING_KEY]?.value || {}
        const raw = Number(
          value.max_visitor_messages_before_first_reply ?? value.max_consecutive_visitor_messages,
        )
        const next = VISITOR_MESSAGE_LIMIT_OPTIONS.includes(raw)
          ? raw
          : DEFAULT_MAX_CONSECUTIVE_VISITOR_MESSAGES
        if (!cancelled) setMaxLimit(next)
      } catch {
        if (!cancelled) setMaxLimit(DEFAULT_MAX_CONSECUTIVE_VISITOR_MESSAGES)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const save = async (next) => {
    setMaxLimit(next)
    setSaving(true)
    try {
      let existing = {}
      try {
        const res = await api(`/settings/${WEBSITE_CHAT_SETTING_KEY}`)
        existing = res?.setting?.value || res?.settings?.[WEBSITE_CHAT_SETTING_KEY]?.value || {}
      } catch {
        existing = {}
      }
      await api(`/settings/${WEBSITE_CHAT_SETTING_KEY}`, {
        method: 'POST',
        body: JSON.stringify({
          value: {
            ...existing,
            max_visitor_messages_before_first_reply: next,
            max_consecutive_visitor_messages: next,
          },
        }),
      })
      showToast('Website chat message limit saved', 'success')
    } catch (e) {
      showToast(e.message || 'Failed to save message limit', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading visitor message limit…</p>
    )
  }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">First Agent Reply Message Limit</h3>
        {!compact ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Before the first support agent reply, visitors may send only this many messages. After an agent responds once, the limit is removed permanently.
          </p>
        ) : null}
      </div>
      <label
        className={
          compact
            ? 'flex flex-col gap-2 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10'
            : 'flex flex-col gap-2 rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/10'
        }
      >
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Maximum visitor messages before first agent reply
        </span>
        <select
          value={maxLimit}
          disabled={saving}
          onChange={(e) => save(Number(e.target.value))}
          className="max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/15 dark:bg-zinc-900 dark:text-gray-100"
        >
          {VISITOR_MESSAGE_LIMIT_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} messages{n === DEFAULT_MAX_CONSECUTIVE_VISITOR_MESSAGES ? ' (default)' : ''}
            </option>
          ))}
        </select>
      </label>
      {saving ? <p className="text-xs text-gray-500 dark:text-gray-400">Saving…</p> : null}
    </div>
  )
}
