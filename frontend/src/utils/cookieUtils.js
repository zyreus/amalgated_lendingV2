const COOKIE_PREFS_STORAGE_KEY = 'amalgated.cookie.preferences.v1'
const COOKIE_PREFS_COOKIE_KEY = 'amalgated_cookie_preferences'
const COOKIE_DEFAULT_EXPIRY_DAYS = 180

const DEFAULT_COOKIE_PREFERENCES = Object.freeze({
  essential: true,
  analytics: false,
  marketing: false,
  preferences: false,
  consentGiven: false,
  updatedAt: null,
  version: 1,
})

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function safeJsonParse(value, fallback = null) {
  if (typeof value !== 'string' || value.trim() === '') return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function sanitizePreferences(raw) {
  const source = raw && typeof raw === 'object' ? raw : {}
  return {
    essential: true,
    analytics: Boolean(source.analytics),
    marketing: Boolean(source.marketing),
    preferences: Boolean(source.preferences),
    consentGiven: Boolean(source.consentGiven),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : null,
    version: Number.isInteger(source.version) ? source.version : 1,
  }
}

export function setCookie(name, value, options = {}) {
  if (!isBrowser() || !name) return false

  const {
    days = COOKIE_DEFAULT_EXPIRY_DAYS,
    path = '/',
    secure = window.location.protocol === 'https:',
    sameSite = 'Lax',
  } = options

  const sanitizedSameSite = ['Strict', 'Lax', 'None'].includes(sameSite) ? sameSite : 'Lax'
  const encodedName = encodeURIComponent(name)
  const encodedValue = encodeURIComponent(value)
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString()
  const secureFlag = secure ? '; Secure' : ''
  const cookieString = `${encodedName}=${encodedValue}; Expires=${expiresAt}; Path=${path}; SameSite=${sanitizedSameSite}${secureFlag}`

  document.cookie = cookieString
  return true
}

export function getCookie(name) {
  if (!isBrowser() || !name) return null
  const encodedName = `${encodeURIComponent(name)}=`
  const cookieParts = document.cookie.split(';')
  for (const part of cookieParts) {
    const trimmed = part.trim()
    if (trimmed.startsWith(encodedName)) {
      return decodeURIComponent(trimmed.substring(encodedName.length))
    }
  }
  return null
}

export function deleteCookie(name, options = {}) {
  if (!isBrowser() || !name) return false
  const path = options.path || '/'
  const secure = options.secure ?? (window.location.protocol === 'https:')
  const sameSite = options.sameSite || 'Lax'
  const secureFlag = secure ? '; Secure' : ''
  document.cookie = `${encodeURIComponent(name)}=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${path}; SameSite=${sameSite}${secureFlag}`
  return true
}

export function saveCookiePreferences(preferences) {
  if (!isBrowser()) return DEFAULT_COOKIE_PREFERENCES

  const sanitized = sanitizePreferences({
    ...preferences,
    consentGiven: true,
    updatedAt: new Date().toISOString(),
    version: 1,
  })

  const serialized = JSON.stringify(sanitized)
  window.localStorage.setItem(COOKIE_PREFS_STORAGE_KEY, serialized)
  setCookie(COOKIE_PREFS_COOKIE_KEY, serialized, { days: COOKIE_DEFAULT_EXPIRY_DAYS, sameSite: 'Lax' })
  return sanitized
}

export function loadCookiePreferences() {
  if (!isBrowser()) return null

  const localRaw = window.localStorage.getItem(COOKIE_PREFS_STORAGE_KEY)
  const cookieRaw = getCookie(COOKIE_PREFS_COOKIE_KEY)
  const parsedLocal = safeJsonParse(localRaw)
  const parsedCookie = safeJsonParse(cookieRaw)
  const source = parsedLocal || parsedCookie

  if (!source || typeof source !== 'object') return null

  const sanitized = sanitizePreferences(source)
  if (!sanitized.consentGiven) return null

  const serialized = JSON.stringify(sanitized)
  window.localStorage.setItem(COOKIE_PREFS_STORAGE_KEY, serialized)
  setCookie(COOKIE_PREFS_COOKIE_KEY, serialized, { days: COOKIE_DEFAULT_EXPIRY_DAYS, sameSite: 'Lax' })
  return sanitized
}

export function getDefaultCookiePreferences() {
  return { ...DEFAULT_COOKIE_PREFERENCES }
}

export const cookiePreferenceKeys = Object.freeze({
  storage: COOKIE_PREFS_STORAGE_KEY,
  cookie: COOKIE_PREFS_COOKIE_KEY,
})
