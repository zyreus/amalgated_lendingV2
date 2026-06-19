let audioCtx = null
let cachedAudio = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

function playBeep(volume = 0.7) {
  const ctx = getAudioContext()
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = 880
  gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.25
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start()
  osc.stop(ctx.currentTime + 0.18)
}

export function playWebsiteChatSound(volume = 0.7) {
  if (typeof window === 'undefined') return
  const vol = Math.max(0, Math.min(1, Number(volume)))

  const tryMp3 = () => {
    if (!cachedAudio) {
      cachedAudio = new Audio('/sounds/new-message.mp3')
      cachedAudio.preload = 'auto'
    }
    cachedAudio.volume = vol
    cachedAudio.currentTime = 0
    return cachedAudio.play()
  }

  tryMp3().catch(() => {
    playBeep(vol)
  })
}

export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export function showWebsiteChatBrowserNotification(payload, onClick) {
  if (typeof window === 'undefined' || !('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null

  const visitorName = payload?.visitor_name || 'Website Visitor'
  const title = payload?.title || 'New Website Chat Message'
  const body = payload?.body || `${visitorName} sent a new message`
  const preview = payload?.message_preview ? `\n"${payload.message_preview}"` : ''

  try {
    const notification = new Notification(title, {
      body: `${body}${preview}`.trim(),
      tag: `website-chat-${payload?.conversation_id || 'general'}`,
      renotify: true,
    })
    notification.onclick = (event) => {
      event.preventDefault()
      window.focus()
      if (typeof onClick === 'function') onClick(payload)
      notification.close()
    }
    return notification
  } catch {
    return null
  }
}

export function formatRelativeTime(iso) {
  if (!iso) return ''
  try {
    const date = new Date(iso)
    const diffMs = Date.now() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
    return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

export function visitorInitials(name) {
  const parts = String(name || 'V').trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return (parts[0]?.[0] || 'V').toUpperCase()
}

export function isWebsiteChatNotification(notification) {
  const type = String(notification?.notification_type || notification?.type || '').toLowerCase()
  return type === 'website_chat_message' || type === 'visitor_chat_message' || type === 'support_sync_visitor'
}

export function websiteChatMeta(notification) {
  const data = notification?.data && typeof notification.data === 'object' ? notification.data : {}
  const route = notification?.route_params && typeof notification.route_params === 'object' ? notification.route_params : {}
  return {
    visitorName: data.visitor_name || 'Website Visitor',
    messagePreview: data.message_preview || notification?.body || '',
    conversationId: notification?.conversation_id || data.conversation_id || data.session_id || route.conversation_id || notification?.resource_id || '',
    messageCount: Number(data.message_count || 1),
    timestamp: data.timestamp || notification?.created_at || null,
  }
}
