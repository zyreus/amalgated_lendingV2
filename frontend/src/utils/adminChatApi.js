/**
 * Chat / CRM API + Socket.IO — Amalgated Holdings adminApi pattern (multi-origin retry).
 * Used by AdminChatDashboard, LendingChatWidget, and lendingApi public inquiry.
 *
 * HTTP: In Vite dev, `/api/*` is proxied to Laravel — chat REST lives on the Node server (8010),
 * so {@link chatHttpBases} tries the chat origin first. Sockets already use {@link adminSocketUrl}.
 */

import { adminFetchUrl } from './adminApi.js'
import { viteChatOriginFromEnv, viteChatSocketOriginFromEnv } from './chatEnvOrigin.js'

export { adminApiBases, rememberWorkingAdminBase, clearWorkingAdminBase } from './adminApi.js'

/** Chat Node origin (https://chat.example.com) — from VITE_CHAT_SERVER_URL or VITE_CHAT_API_URL. */
const API_BASE = viteChatOriginFromEnv()

/** Persisted origin that successfully served chat/CRM REST (separate from Laravel adminApi). */
const CHAT_ORIGIN_STORAGE_KEY = 'lending_chat_working_api_origin'

/** Same key as lendingApi `setSessionLendingAdminSecret` — Bearer for Node (LENDING_ADMIN_API_SECRET). */
const SESSION_LENDING_SECRET_KEY = 'lending_admin_api_secret'

export function setSessionLendingAdminSecret(secret) {
  try {
    if (typeof sessionStorage === 'undefined') return
    const value = String(secret || '').trim()
    if (value) sessionStorage.setItem(SESSION_LENDING_SECRET_KEY, value)
    else sessionStorage.removeItem(SESSION_LENDING_SECRET_KEY)
  } catch {
    /* ignore */
  }
}

export function clearSessionLendingAdminSecret() {
  setSessionLendingAdminSecret('')
}

function getLendingSecretForChat() {
  const fromEnv =
    (import.meta.env.VITE_LENDING_ADMIN_API_SECRET || '').trim() ||
    (import.meta.env.VITE_CHAT_API_SECRET || '').trim()
  if (fromEnv) return fromEnv
  try {
    return sessionStorage.getItem(SESSION_LENDING_SECRET_KEY)?.trim() || ''
  } catch {
    return ''
  }
}

/** Default Node chat/Socket.IO origin in dev (see chat-server `PORT`, usually 8010). */
const DEFAULT_CHAT_DEV_ORIGIN = 'http://127.0.0.1:8010'
const DEFAULT_CHAT_DEV_FALLBACK_ORIGIN = 'http://127.0.0.1:8011'
const DEFAULT_CHAT_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_CHAT_REQUEST_TIMEOUT_MS || 15000)

function localDevChatOriginsFromWindow() {
  if (typeof window === 'undefined' || !window.location) return []
  const host = String(window.location.hostname || '').trim()
  if (!host) return []
  // Public domains: do not use hostname:8010 (browser cannot reach Node on that port). Use chat subdomain.
  if (isLikelyPublicHostname(host)) {
    const derived = publicSiteChatNodeOrigin(host, window.location.protocol)
    return derived ? [derived] : []
  }
  const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return [`${protocol}//${host}:8010`, `${protocol}//${host}:8011`]
}

function normalizePublicHostname(hostname) {
  const h = String(hostname || '').toLowerCase().trim()
  if (!h) return ''
  if (h.startsWith('www.')) return h.slice(4)
  return h
}

function isLikelyPublicHostname(hostname) {
  const h = String(hostname || '').toLowerCase()
  if (!h) return false
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]') return false
  return h.includes('.')
}

/**
 * Node chat/Socket.IO host for a “real” site hostname. Used in production and in Vite dev
 * when the page is opened as https://amalgatedlending.com/... (never use that host:8010 from the browser).
 */
function publicSiteChatNodeOrigin(hostname, protocol) {
  const host = normalizePublicHostname(hostname)
  if (!isLikelyPublicHostname(host)) return ''
  const p = protocol === 'https:' ? 'https:' : 'http:'
  if (host === 'amalgatedlending.com' || host === 'www.amalgatedlending.com') {
    return `${p}//chat.amalgatedlending.com`
  }
  if (host === 'chat.amalgatedlending.com') return `${p}//chat.amalgatedlending.com`
  if (host.startsWith('chat.')) return `${p}//${host}`
  return `${p}//chat.${host}`
}

function deriveProdChatOriginFromLocation() {
  if (typeof window === 'undefined' || !window.location) return ''
  if (import.meta.env.DEV) return ''
  return publicSiteChatNodeOrigin(window.location.hostname, window.location.protocol)
}

/** Legacy dev saves pointed at hostname:8010; that never works for public domains in the browser. */
function dropStaleDevChatOriginSave(saved, pageHostname) {
  const s = String(saved || '').trim()
  if (!s) return true
  const host = String(pageHostname || '').trim()
  if (!isLikelyPublicHostname(host)) return false
  return /:\d{4,5}\/?$/.test(s.replace(/\/$/, ''))
}

function shouldPreferDerivedProdOrigin() {
  if (typeof window === 'undefined' || import.meta.env.DEV) return false
  const pageHost = normalizePublicHostname(window.location?.hostname)
  if (!pageHost) return false
  // Prefer canonical chat host when browsing the main lending domain.
  if (pageHost === 'amalgatedlending.com' || pageHost === 'www.amalgatedlending.com') return true
  return !API_BASE
}

function preferredChatOrigin() {
  if (API_BASE) return API_BASE
  const derivedProd = deriveProdChatOriginFromLocation()
  if (shouldPreferDerivedProdOrigin() && derivedProd) return derivedProd
  if (import.meta.env.DEV) return ''
  return derivedProd
}

export function resolvedChatServerOrigin() {
  const socketEnv = viteChatSocketOriginFromEnv()
  if (socketEnv) return socketEnv
  const preferred = preferredChatOrigin()
  if (preferred) return preferred
  if (typeof window !== 'undefined' && import.meta.env.DEV) return devNodeChatOrigin()
  return typeof window !== 'undefined' ? window.location.origin : ''
}

/**
 * Holdings Node (Socket.IO + chat API) origin in dev.
 * Never use `VITE_API_PROXY_TARGET` here — that is Laravel; Socket.IO must hit the Node chat server
 * (`npm run serve:chat` / port 8010 by default).
 */
export function devNodeChatOrigin() {
  const fromWindow = localDevChatOriginsFromWindow()[0]
  if (fromWindow) return fromWindow
  const explicit = (import.meta.env.VITE_CHAT_DEV_ORIGIN || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  const chatTarget = (import.meta.env.VITE_CHAT_PROXY_TARGET || '').trim().replace(/\/$/, '')
  if (chatTarget) return chatTarget
  const apiProxy = (import.meta.env.VITE_API_PROXY_TARGET || '').trim().replace(/\/$/, '')
  // Legacy docs assumed Laravel on :8000 with no separate env for Node; still map to chat port only.
  if (apiProxy && /:8000\/?$/.test(apiProxy)) {
    return DEFAULT_CHAT_DEV_ORIGIN
  }
  return DEFAULT_CHAT_DEV_ORIGIN
}

function devNodeChatOrigins() {
  const candidates = []
  const add = (value) => {
    const s = String(value || '').trim().replace(/\/$/, '')
    if (!s || candidates.includes(s)) return
    candidates.push(s)
  }

  for (const candidate of localDevChatOriginsFromWindow()) add(candidate)
  add((import.meta.env.VITE_CHAT_DEV_ORIGIN || '').trim())
  add((import.meta.env.VITE_CHAT_PROXY_TARGET || '').trim())
  add(DEFAULT_CHAT_DEV_ORIGIN)
  add(DEFAULT_CHAT_DEV_FALLBACK_ORIGIN)
  // Chat server auto-falls back from 8010 -> 8011 when the port is occupied.
  add(DEFAULT_CHAT_DEV_ORIGIN.replace(/:8010$/, ':8011'))

  return candidates
}

/**
 * Socket.IO URL. Prefer VITE_CHAT_SERVER_URL.
 * In dev, connect straight to the Node chat port (see {@link devNodeChatOrigin}) so traffic does not go through
 * Vite’s `/socket.io` proxy — that avoids noisy `ws proxy error` / ECONNABORTED logs when sockets reconnect.
 */
export function adminSocketUrl() {
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    try {
      const saved = localStorage.getItem(CHAT_ORIGIN_STORAGE_KEY)?.trim()
      if (saved && !dropStaleDevChatOriginSave(saved, window.location.hostname)) {
        return saved.replace(/\/$/, '')
      }
      if (saved && dropStaleDevChatOriginSave(saved, window.location.hostname)) {
        localStorage.removeItem(CHAT_ORIGIN_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
    const [first] = devNodeChatOrigins()
    if (first) return first
  }
  return resolvedChatServerOrigin()
}

export function adminSocketUrls() {
  const urls = []
  const add = (value) => {
    const s = String(value || '').trim().replace(/\/$/, '')
    if (!s || urls.includes(s)) return
    urls.push(s)
  }

  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    for (const candidate of devNodeChatOrigins()) add(candidate)
    try {
      const saved = localStorage.getItem(CHAT_ORIGIN_STORAGE_KEY)?.trim()
      if (saved && !dropStaleDevChatOriginSave(saved, window.location.hostname)) add(saved)
      else if (saved && dropStaleDevChatOriginSave(saved, window.location.hostname)) {
        localStorage.removeItem(CHAT_ORIGIN_STORAGE_KEY)
      }
    } catch {
      /* ignore */
    }
    add(window.location.origin)
    return urls
  }

  const preferred = resolvedChatServerOrigin()
  if (preferred) add(preferred)
  if (API_BASE) add(API_BASE)
  if (typeof window !== 'undefined' && shouldIncludeMainSiteAsChatFallback()) add(window.location.origin)
  return urls
}

function addChatBase(bases, b) {
  const s = b === '' || b == null ? '' : String(b).replace(/\/$/, '')
  if (!bases.includes(s)) bases.push(s)
}

/**
 * Resolved chat/socket origin hints (env + derived subdomain). Empty if unknown build.
 */
function explicitChatOriginForFallbackPolicy() {
  return (
    viteChatSocketOriginFromEnv().trim() ||
    preferredChatOrigin().trim()
  ).trim()
}

/**
 * Include `window.location.origin` after chat subdomain candidates only when topology might proxy
 * Node under the SPA host — never for split-host prod (marketing vs chat.*).
 * Set `VITE_CHAT_SAME_ORIGIN_FALLBACK=1` to force the extra probe.
 */
function shouldIncludeMainSiteAsChatFallback() {
  if (typeof window === 'undefined') return false
  const force = String(import.meta.env.VITE_CHAT_SAME_ORIGIN_FALLBACK || '').toLowerCase()
  if (['1', 'true', 'yes'].includes(force)) return true
  const raw = explicitChatOriginForFallbackPolicy()
  if (!raw) return true
  try {
    new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    // Explicit chat URL in env/preferred — `resolved`/preferred already targets it or same-origin; skip extra main-host probes for split-domain prod.
    return false
  } catch {
    return true
  }
}

/**
 * Origins for chat/CRM REST (`/api/admin/...`, `/api/feedback`, etc.).
 * Dev: Node first (Vite’s `/api` proxy targets Laravel only).
 */
export function chatHttpBases() {
  const bases = []
  const preferred = preferredChatOrigin()
  if (preferred) {
    addChatBase(bases, preferred)
    if (API_BASE && API_BASE !== preferred) addChatBase(bases, API_BASE)
  } else if (typeof window !== 'undefined' && import.meta.env.DEV) {
    for (const candidate of devNodeChatOrigins()) {
      addChatBase(bases, candidate)
    }
    addChatBase(bases, '')
  } else if (typeof window !== 'undefined') {
    const resolved = resolvedChatServerOrigin()
    addChatBase(bases, resolved)
    // Same-origin only when chat host is unknown or forced — split-host prod should not 404 spam the main domain.
    if (shouldIncludeMainSiteAsChatFallback()) addChatBase(bases, window.location.origin)
  } else {
    addChatBase(bases, '')
  }
  // Saved working origin is useful in dev, but do not reuse it in production.
  try {
    if (typeof localStorage !== 'undefined' && import.meta.env.DEV) {
      const saved = localStorage.getItem(CHAT_ORIGIN_STORAGE_KEY)
      if (saved != null) addChatBase(bases, saved)
    }
  } catch {
    /* ignore */
  }
  return bases
}

function rememberChatWorkingBase(base) {
  try {
    if (typeof localStorage === 'undefined') return
    const s = base === '' || base == null ? '' : String(base).replace(/\/$/, '')
    localStorage.setItem(CHAT_ORIGIN_STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

function shouldRetryStatus(status) {
  return status === 404 || status === 502 || status === 503
}

function combineAbortSignals(primary, secondary) {
  if (!primary) return secondary
  if (!secondary) return primary
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
    return AbortSignal.any([primary, secondary])
  }
  return primary
}

async function chatRequest(path, init = {}) {
  const bases = chatHttpBases()
  let lastRes = null
  for (const base of bases) {
    const url = adminFetchUrl(base, path)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_CHAT_REQUEST_TIMEOUT_MS)
    const mergedSignal = combineAbortSignals(init.signal, controller.signal)
    try {
      const res = await fetch(url, { cache: 'no-store', ...init, signal: mergedSignal })
      lastRes = res
      if (shouldRetryStatus(res.status)) continue
      if (res.status === 401 || res.status === 403) continue
      // Some hosts return SPA HTML (200) for unknown /api paths; treat as wrong origin and try next base.
      if (res.ok && String(path || '').startsWith('/api')) {
        const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase()
        if (contentType.includes('text/html')) continue
      }
      if (res.ok) rememberChatWorkingBase(base)
      return { res, base }
    } catch {
      continue
    } finally {
      clearTimeout(timeoutId)
    }
  }
  return { res: lastRes, base: null }
}

/**
 * Primary URL for a path (first candidate base). Prefer for display or one-off fetches.
 * For resilient requests use {@link chatFetch} / {@link publicChatFetch}.
 */
export function chatApiUrl(path) {
  const bases = chatHttpBases()
  const base = bases[0] ?? ''
  return adminFetchUrl(base, path)
}

/**
 * Auth headers for Node chat/CRM API.
 */
export function getChatAuthHeaders() {
  const secret = getLendingSecretForChat()
  return {
    Authorization: secret ? `Bearer ${secret}` : '',
    'Content-Type': 'application/json',
  }
}

/** True when env or session has the Node shared secret (required for Chat & CRM REST). */
export function hasChatServerAuth() {
  return Boolean(getLendingSecretForChat())
}

/** Node LENDING_ADMIN_API_SECRET — used for Socket.IO admin:join authentication. */
export function getLendingChatSecret() {
  return getLendingSecretForChat()
}

/**
 * Authenticated chat admin request — tries Node chat origin before same-origin in dev.
 */
export async function chatFetch(path, init = {}) {
  const auth = getChatAuthHeaders()
  const headers = { ...auth, ...init.headers }
  return chatRequest(path, { cache: 'no-store', ...init, headers })
}

export async function chatJson(path, init = {}) {
  const auth = getChatAuthHeaders()
  const headers = { ...auth, ...init.headers }
  const { res, base } = await chatRequest(path, { cache: 'no-store', ...init, headers })
  const data = (await res?.json?.().catch(() => ({}))) ?? {}
  return { res, data, base }
}

/**
 * Public visitor endpoints (no Bearer) — same origin ordering as {@link chatHttpBases}.
 */
export async function publicChatFetch(path, init = {}) {
  return chatRequest(path, { cache: 'no-store', ...init })
}

export async function publicChatJson(path, init = {}) {
  const { res, base } = await chatRequest(path, { cache: 'no-store', ...init })
  const data = (await res?.json?.().catch(() => ({}))) ?? {}
  return { res, data, base }
}
