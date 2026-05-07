/**
 * Amalgated Holdings–style admin/chat API resolution (ported for Amalgated Lending).
 * Fixes wrong-port Node, Laravel vs Node mixups, and dev proxy ordering.
 *
 * @see Amalgated_Holdings/Amalgated_Holdings/src/utils/adminApi.js
 */

import { viteChatOriginFromEnv } from './chatEnvOrigin.js'

const STORAGE_KEY = 'lending_admin_working_api_origin'

const API_BASE = viteChatOriginFromEnv()

function addBase(bases, b) {
  const s = b === '' || b == null ? '' : String(b).replace(/\/$/, '')
  if (!bases.includes(s)) bases.push(s)
}

/**
 * Ordered list of origins to try (empty string = same origin / Vite proxy in dev).
 */
export function adminApiBases() {
  const bases = []
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved != null) addBase(bases, saved)
    }
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    addBase(bases, '')
  }
  if (API_BASE) addBase(bases, API_BASE)
  if (bases.length === 0) addBase(bases, '')
  return bases
}

export function adminFetchUrl(base, path) {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!base) return p
  return `${base.replace(/\/$/, '')}${p}`
}

export function rememberWorkingAdminBase(base) {
  try {
    if (typeof localStorage === 'undefined') return
    const s = base === '' || base == null ? '' : String(base).replace(/\/$/, '')
    localStorage.setItem(STORAGE_KEY, s)
  } catch {
    /* ignore */
  }
}

export function clearWorkingAdminBase() {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

function shouldRetryStatus(status) {
  return status === 404 || status === 502 || status === 503
}

/**
 * Try each base until a response is returned that we should not skip.
 * Skips 404/502/503 and 401/403 (try next origin — e.g. Laravel vs Node).
 * On res.ok, remembers the working base.
 */
export async function adminRequest(path, init = {}) {
  const bases = adminApiBases()
  let lastRes = null
  for (const base of bases) {
    const url = adminFetchUrl(base, path)
    try {
      const res = await fetch(url, { cache: 'no-store', ...init })
      lastRes = res
      if (shouldRetryStatus(res.status)) continue
      if (res.status === 401 || res.status === 403) continue
      if (res.ok) rememberWorkingAdminBase(base)
      return { res, base }
    } catch {
      continue
    }
  }
  return { res: lastRes, base: null }
}

/** Same as adminRequest, then parses JSON body (empty object on failure). */
export async function adminJson(path, init = {}) {
  const { res, base } = await adminRequest(path, init)
  const data = (await res?.json?.().catch(() => ({}))) ?? {}
  return { res, data, base }
}

/**
 * POST JSON — same retry rules as adminRequest; remembers base on res.ok.
 */
export async function adminPostJson(path, body, init = {}) {
  const bases = adminApiBases()
  let lastRes = null
  const headers = { 'Content-Type': 'application/json', ...(init.headers || {}) }
  for (const base of bases) {
    const url = adminFetchUrl(base, path)
    try {
      const res = await fetch(url, {
        ...init,
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: 'no-store',
      })
      lastRes = res
      if (shouldRetryStatus(res.status)) continue
      if (res.status === 401 || res.status === 403) continue
      if (res.ok) rememberWorkingAdminBase(base)
      return { res, base }
    } catch {
      continue
    }
  }
  return { res: lastRes, base: null }
}
