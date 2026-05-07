/**
 * Laravel JWT API base resolution (Holdings-style): dev proxy + explicit URL.
 * Used by admin/api/client.js for /api/v1 routes.
 */

import axios from 'axios'

const STORAGE_KEY = 'lending_laravel_working_api_base'

/** Axios timeout for Laravel (large uploads). Override with VITE_LENDING_REQUEST_TIMEOUT_MS. */
const LARAVEL_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_LENDING_REQUEST_TIMEOUT_MS || 120000)

/** Message when all Laravel bases failed (network/DNS/timeout). */
export function formatLaravelUnreachableError(lastError) {
  const detail =
    lastError && typeof lastError.message === 'string' ? lastError.message : ''
  return detail
    ? `Could not reach lending API (${detail}).`
    : 'Could not reach lending API (check Laravel URL and Vite proxy).'
}

function isLoopbackHostname(host) {
  if (!host) return true
  const h = String(host).toLowerCase()
  return h === '0.0.0.0' || h === '[::1]'
}

function addBase(bases, b) {
  const s = b === '' || b == null ? '' : String(b).replace(/\/$/, '')
  if (!bases.includes(s)) bases.push(s)
}

function isLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]'
}

function parseOriginLike(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  try {
    const withProto = raw.startsWith('http') ? raw : `https://${raw}`
    const u = new URL(withProto)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

/**
 * Ensure absolute bases always end with `/api/v1` so login hits Laravel JWT routes,
 * not `/admin/login` at the app root (404).
 */
export function normalizeLaravelApiBase(base) {
  if (base === '' || base == null) return ''
  const s = String(base).trim().replace(/\/$/, '')
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) return s
  if (/\/api\/v1$/i.test(s)) return s
  if (/\/api$/i.test(s)) return `${s}/v1`
  return `${s}/api/v1`
}

function buildUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (base === '' || base == null) {
    return `/api/v1${p}`
  }
  return `${String(base).replace(/\/$/, '')}${p}`
}

export function laravelApiBases() {
  const bases = []
  const explicit = (import.meta.env.VITE_LENDING_API_URL || '').trim().replace(/\/$/, '')
  const winHost =
    typeof window !== 'undefined' && window.location?.hostname ? String(window.location.hostname) : ''
  const onPublicHost = !isLoopbackHostname(winHost)

  // Dev: same-origin `/api/v1` via Vite proxy.
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    addBase(bases, '')
  }

  if (explicit) {
    addBase(bases, normalizeLaravelApiBase(explicit))
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved != null) {
        const normalized = normalizeLaravelApiBase(saved)
        addBase(bases, normalized)
      }
    }
  } catch {
    /* ignore */
  }

  // Production, no build-time API URL: same-origin `/api/v1` (Laravel docroot same as SPA) or subdomain URL in .env.production.
  if (typeof window !== 'undefined' && import.meta.env.PROD && onPublicHost && !explicit) {
    addBase(bases, '')
  }

  if (bases.length === 0) {
    addBase(bases, '')
  }
  return bases
}

/**
 * Laravel app origin where `/storage/...` is served (uploads, public disk).
 * Do not use `window.location.origin` from the Vite dev server — it is not Laravel.
 */
export function getLaravelPublicOrigin() {
  const override = (import.meta.env.VITE_LENDING_PUBLIC_URL || '').trim()
  const overrideOrigin = parseOriginLike(override)
  const apiUrlOrigin = parseOriginLike(import.meta.env.VITE_LENDING_API_URL || '')

  // In local dev, prefer same-origin so file URLs go through Vite proxy (/api -> Laravel).
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    if (overrideOrigin) {
      try {
        const ou = new URL(overrideOrigin)
        if (isLocalHostname(ou.hostname)) return overrideOrigin
      } catch {
        /* ignore */
      }
    }
    if (apiUrlOrigin) {
      try {
        const au = new URL(apiUrlOrigin)
        if (isLocalHostname(au.hostname)) return apiUrlOrigin
      } catch {
        /* ignore */
      }
    }
    if (window.location?.origin) return window.location.origin
  }

  if (overrideOrigin) return overrideOrigin
  if (apiUrlOrigin) return apiUrlOrigin
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/**
 * Absolute URL for a file on the `public` disk, e.g. `borrower-receipts/xxx.png`.
 */
export function getLaravelStorageFileUrl(relativePath) {
  if (relativePath == null || relativePath === '') return ''
  const s = String(relativePath).trim()
  if (!s) return ''
  const publicOrigin = getLaravelPublicOrigin()

  const toPublicFilesUrl = (pathOnly) => {
    const clean = String(pathOnly || '')
      .replace(/^\/+/, '')
      .replace(/\\/g, '/')
    if (!clean) return ''
    const encoded = clean
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join('/')
    return `${publicOrigin}/api/v1/public-files/${encoded}`
  }

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      const m = u.pathname.match(/^\/storage\/(.+)$/i)
      if (m && m[1]) {
        return toPublicFilesUrl(m[1])
      }
      return s
    } catch {
      return s
    }
  }

  const clean = s.replace(/^\/+/, '')
  return toPublicFilesUrl(clean)
}

export function rememberWorkingLaravelBase(base) {
  try {
    if (typeof localStorage === 'undefined') return
    const s = base === '' || base == null ? '' : normalizeLaravelApiBase(String(base).replace(/\/$/, ''))
    localStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

function shouldRetryStatus(status) {
  // Retry other candidate bases on server-side failures and common gateway misses.
  return status === 404 || status >= 500
}

/**
 * Try each Laravel base. Does not hop on 401 (same credentials on all).
 * Uses axios (project HTTP standard); returns a fetch-shaped `res` for callers.
 */
export async function laravelRequest(path, init = {}) {
  const bases = laravelApiBases()
  let lastRes = null
  let lastNetworkError = null
  const method = String(init.method || 'GET').toUpperCase()
  const headers = { ...(init.headers || {}) }
  let data
  if (init.body != null && init.body !== '') {
    if (typeof init.body === 'string') {
      const ct = String(headers['Content-Type'] || headers['content-type'] || '').toLowerCase()
      if (ct.includes('application/json')) {
        try {
          data = JSON.parse(init.body)
        } catch {
          data = init.body
        }
      } else {
        data = init.body
      }
    } else {
      data = init.body
    }
  }
  for (const base of bases) {
    const url = buildUrl(base, path)
    try {
      const response = await axios({
        url,
        method,
        headers,
        data: method === 'GET' || method === 'HEAD' ? undefined : data,
        validateStatus: () => true,
        signal: init.signal,
        timeout: LARAVEL_REQUEST_TIMEOUT_MS,
      })
      const res = {
        ok: response.status >= 200 && response.status < 300,
        status: response.status,
        headers: {
          get: (name) => response.headers[String(name || '').toLowerCase()],
        },
        json: async () => response.data,
        text: async () =>
          typeof response.data === 'string'
            ? response.data
            : response.data == null
              ? ''
              : JSON.stringify(response.data),
      }
      lastRes = res
      if (shouldRetryStatus(response.status)) continue
      if (res.ok) rememberWorkingLaravelBase(base)
      return { res, base, lastError: null }
    } catch (e) {
      lastNetworkError = e
      continue
    }
  }
  return { res: lastRes, base: null, lastError: lastNetworkError }
}

/**
 * Unauthenticated POST to /api/v1/... (forgot password, etc.).
 */
export async function publicLaravelPost(path, body) {
  const rel = path.startsWith('/') ? path : `/${path}`
  const { res, lastError } = await laravelRequest(rel, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!res) {
    const err = new Error(formatLaravelUnreachableError(lastError))
    err.status = 0
    throw err
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = data.message || data.error
    if (!msg && data.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    const err = new Error(msg || `HTTP ${res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }
  return data
}
