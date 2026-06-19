/** Default website chat notification preferences (matches Laravel NotificationCenter). */
export const DEFAULT_WEBSITE_CHAT_SETTINGS = {
  enabled: true,
  sound: true,
  browser: true,
  badge_updates: true,
  crm_inbox_updates: true,
  auto_open_crm: false,
  sound_volume: 0.7,
}

const STORAGE_KEY = 'admin.website_chat_notification_settings'

export function mergeWebsiteChatSettings(current = {}, patch = {}) {
  return {
    ...DEFAULT_WEBSITE_CHAT_SETTINGS,
    ...current,
    ...patch,
    sound_volume: Math.max(0, Math.min(1, Number(
      patch.sound_volume ?? current.sound_volume ?? DEFAULT_WEBSITE_CHAT_SETTINGS.sound_volume,
    ))),
  }
}

export function readLocalWebsiteChatSettings() {
  if (typeof window === 'undefined') return { ...DEFAULT_WEBSITE_CHAT_SETTINGS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEBSITE_CHAT_SETTINGS }
    return mergeWebsiteChatSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_WEBSITE_CHAT_SETTINGS }
  }
}

export function writeLocalWebsiteChatSettings(settings) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeWebsiteChatSettings(settings)))
  } catch {
    /* ignore quota errors */
  }
}

export async function fetchWebsiteChatSettings(api) {
  try {
    const res = await api('/notification-preferences')
    const remote = res?.data?.website_chat_settings
    const merged = mergeWebsiteChatSettings(remote || {})
    writeLocalWebsiteChatSettings(merged)
    return merged
  } catch {
    return readLocalWebsiteChatSettings()
  }
}

export async function saveWebsiteChatSettings(api, patch) {
  const merged = mergeWebsiteChatSettings(readLocalWebsiteChatSettings(), patch)
  writeLocalWebsiteChatSettings(merged)
  try {
    const res = await api('/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ website_chat_settings: merged }),
    })
    const saved = mergeWebsiteChatSettings(res?.data?.website_chat_settings || merged)
    writeLocalWebsiteChatSettings(saved)
    return saved
  } catch {
    return merged
  }
}
