import { useEffect, useState } from 'react'
import { api } from '../api/client.js'
import { useToast } from '../context/ToastContext.jsx'
import {
  DEFAULT_WEBSITE_CHAT_SETTINGS,
  fetchWebsiteChatSettings,
  saveWebsiteChatSettings,
} from '../utils/websiteChatNotificationSettings.js'
import { requestBrowserNotificationPermission } from '../utils/websiteChatNotificationEffects.js'

export default function WebsiteChatNotificationSettings({ compact = false }) {
  const { showToast } = useToast()
  const [settings, setSettings] = useState(DEFAULT_WEBSITE_CHAT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const merged = await fetchWebsiteChatSettings(api)
      if (!cancelled) {
        setSettings(merged)
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const update = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setSaving(true)
    try {
      const saved = await saveWebsiteChatSettings(api, patch)
      setSettings(saved)
      if (patch.browser === true) {
        const perm = await requestBrowserNotificationPermission()
        if (perm === 'denied') {
          showToast('Browser notifications are blocked. Enable them in your browser settings.', 'error')
        }
      }
      window.dispatchEvent(new CustomEvent('website-chat-settings-changed', { detail: saved }))
    } catch (e) {
      showToast(e.message || 'Failed to save notification settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Loading website chat notification settings…
      </p>
    )
  }

  const rowClass = compact
    ? 'flex items-start justify-between gap-3 rounded-xl border border-gray-200 px-3 py-2.5 dark:border-white/10'
    : 'flex items-start justify-between gap-4 rounded-2xl border border-gray-200 px-4 py-3 dark:border-white/10'

  const rows = [
    { key: 'enabled', label: 'Enable Notifications', hint: 'Show in-app alerts for new website chat messages.' },
    { key: 'sound', label: 'Enable Sound Alert', hint: 'Play a sound when a new visitor message arrives.' },
    { key: 'browser', label: 'Enable Browser Notifications', hint: 'Show desktop notifications when permitted.' },
    { key: 'badge_updates', label: 'Enable Realtime Badge Updates', hint: 'Update the bell counter instantly.' },
    { key: 'crm_inbox_updates', label: 'Enable CRM Inbox Realtime Updates', hint: 'Refresh CRM inbox previews without opening CRM.' },
    { key: 'auto_open_crm', label: 'Auto Open CRM On New Message', hint: 'Not recommended — opens CRM automatically (default off).' },
  ]

  return (
    <div className={compact ? 'space-y-2' : 'space-y-4'}>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Website Chat Notifications</h3>
        {!compact ? (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Control how you are alerted when visitors send messages from the website chat widget.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        {rows.map(({ key, label, hint }) => (
          <label key={key} className={rowClass}>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
              {!compact ? <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{hint}</span> : null}
            </span>
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              disabled={saving || (key !== 'enabled' && !settings.enabled)}
              onChange={(e) => update({ [key]: e.target.checked })}
              className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
          </label>
        ))}
      </div>

      <div className={rowClass}>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">Notification Volume</span>
          {!compact ? (
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
              Adjust sound alert volume ({Math.round(settings.sound_volume * 100)}%).
            </span>
          ) : null}
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.sound_volume}
          disabled={saving || !settings.enabled || !settings.sound}
          onChange={(e) => update({ sound_volume: Number(e.target.value) })}
          className="mt-2 w-28 shrink-0 accent-red-600"
        />
      </div>

      {saving ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">Saving…</p>
      ) : null}
    </div>
  )
}
