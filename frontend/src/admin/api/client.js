import {
  laravelRequest,
  normalizeLaravelApiBase,
  formatLaravelUnreachableError,
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
      if (data.retry_after != null) err.retry_after = Number(data.retry_after)
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

  const { res, lastError } = await laravelRequest(rel, {
    ...options,
    headers,
    ...(isFormData
      ? {
          uploadTrackId: options.uploadTrackId || `admin-upload-${Date.now()}`,
          uploadLabel: options.uploadLabel || 'Uploading...',
        }
      : {}),
  })
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
    if (data.retry_after != null) err.retry_after = Number(data.retry_after)
    throw err
  }

  return data
}

export { API_BASE }
