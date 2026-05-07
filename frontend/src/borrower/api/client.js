import { laravelRequest, formatLaravelUnreachableError } from '../../utils/lendingLaravelApi.js'

const TOKEN_KEY = 'borrower_token'

export function getBorrowerToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setBorrowerToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export async function borrowerApi(path, options = {}) {
  const rel = path.startsWith('/') ? path : `/${path}`
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = {
    Accept: 'application/json',
    ...options.headers,
  }
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
  }
  const token = getBorrowerToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const { res, lastError } = await laravelRequest(rel, { ...options, headers })
  if (!res) {
    const err = new Error(formatLaravelUnreachableError(lastError))
    err.status = 0
    throw err
  }

  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !rel.includes('/borrower/login')) {
    setBorrowerToken(null)
    window.dispatchEvent(new CustomEvent('lending-borrower-unauthorized'))
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
    const err = new Error(msg || `HTTP ${res.status}`)
    err.status = res.status
    err.body = data
    throw err
  }

  return data
}
