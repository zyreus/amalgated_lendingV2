import axios from 'axios'
import {
  laravelRequest,
  normalizeLaravelApiBase,
  formatLaravelUnreachableError,
  laravelApiBases,
} from '../../utils/lendingLaravelApi.js'

/** Default display / docs; actual requests use {@link laravelRequest} multi-base resolution. */
const API_BASE = (
  normalizeLaravelApiBase(import.meta.env.VITE_LENDING_API_URL || '') || '/api/v1'
).replace(/\/$/, '')

const TOKEN_KEY = 'admin_token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function api(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  if (path.startsWith('http')) {
    const headers = {
      Accept: 'application/json',
      ...options.headers,
    }
    if (!isFormData) headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`

    const res = await fetch(path, { ...options, headers })
    const data = await res.json().catch(() => ({}))

    if (res.status === 401 && !path.includes('/admin/login')) {
      setToken(null)
      window.dispatchEvent(new CustomEvent('lending-admin-unauthorized'))
    }

    if (!res.ok) {
      let msg = data.message || data.error
      if (!msg && data.errors && typeof data.errors === 'object') {
        const flat = Object.values(data.errors).flat()
        if (flat.length) msg = flat.join(' ')
      }
      if (!msg && res.status === 404) {
        msg = import.meta.env.DEV
          ? 'Lending API returned 404. Run `npm run dev` (starts Laravel + Vite) or `npm run serve:laravel` in another terminal, then verify `/api/v1/health` returns {"ok":true}.'
          : 'Lending API returned 404. Check API docroot, APP_URL, and that the SPA was built with VITE_LENDING_API_URL if the API is on another host.'
      }
      if (!msg) msg = `HTTP ${res.status}`
      const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
      err.status = res.status
      err.body = data
      throw err
    }

    return data
  }

  const rel = path.startsWith('/') ? path : `/${path}`
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (!isFormData) headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const { res, lastError } = await laravelRequest(rel, { ...options, headers })
  if (!res) {
    const err = new Error(formatLaravelUnreachableError(lastError))
    err.status = 0
    throw err
  }

  const data = await res.json().catch(() => ({}))

  if (res.status === 401 && !rel.includes('/admin/login')) {
    setToken(null)
    window.dispatchEvent(new CustomEvent('lending-admin-unauthorized'))
  }

  if (!res.ok) {
    let msg = data.message || data.error
    if (!msg && data.errors && typeof data.errors === 'object') {
      const flat = Object.values(data.errors).flat()
      if (flat.length) msg = flat.join(' ')
    }
    if (!msg && res.status === 404) {
      msg = import.meta.env.DEV
        ? 'Lending API returned 404. Run `npm run dev` (starts Laravel + Vite) or `npm run serve:laravel`, then verify `/api/v1/health` returns {"ok":true}.'
        : 'Lending API returned 404. Check API docroot, APP_URL, and that the SPA was built with VITE_LENDING_API_URL if the API is on another host.'
    }
    if (!msg) msg = `HTTP ${res.status}`
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}

/**
 * Authenticated binary download (e.g. careers resume). Tries the same API bases as {@link api}.
 */
export async function downloadAdminFile(relPath, suggestedFilename) {
  const rel = relPath.startsWith('/') ? relPath : `/${relPath}`
  const token = getToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let lastError = null
  for (const base of laravelApiBases()) {
    const url =
      base === '' || base == null
        ? `/api/v1${rel}`
        : `${String(normalizeLaravelApiBase(base) || base).replace(/\/$/, '')}${rel}`
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'blob',
        headers,
        timeout: Number(import.meta.env.VITE_LENDING_REQUEST_TIMEOUT_MS || 120000),
        validateStatus: () => true,
      })
      if (response.status >= 200 && response.status < 300) {
        const blob = response.data
        const href = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = suggestedFilename || 'download'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(href)
        return
      }
      if (response.status === 401 && !rel.includes('/admin/login')) {
        setToken(null)
        window.dispatchEvent(new CustomEvent('lending-admin-unauthorized'))
      }
      lastError = new Error(`HTTP ${response.status}`)
    } catch (e) {
      lastError = e
    }
  }
  const err = lastError || new Error(formatLaravelUnreachableError(null))
  throw err
}

export { API_BASE }
