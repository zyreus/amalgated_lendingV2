/**
 * Normalizes VITE_CHAT_SERVER_URL or VITE_CHAT_API_URL (may include `/api`) to an origin
 * for Socket.IO and chat REST (`origin + /api/admin/...`).
 */
export function viteChatOriginFromEnv() {
  const raw = (
    import.meta.env.VITE_CHAT_SERVER_URL ||
    import.meta.env.VITE_CHAT_API_URL ||
    ''
  ).trim()
  if (!raw) return ''
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(withScheme).origin
  } catch {
    return withScheme.replace(/\/api\/?$/i, '').replace(/\/$/, '')
  }
}

/** Optional explicit WebSocket URL → origin for socket.io-client (expects http/https URL). */
export function viteChatSocketOriginFromEnv() {
  const raw = (import.meta.env.VITE_CHAT_WS_URL || '').trim()
  if (!raw) return ''
  const normalized = raw.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:')
  try {
    return new URL(normalized).origin
  } catch {
    return ''
  }
}
