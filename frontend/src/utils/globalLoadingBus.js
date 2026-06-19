/**
 * Lightweight pub/sub for global loading state (usable outside React).
 * Consumed by LoadingProvider and laravelRequest.
 */

const listeners = new Set()

let pendingRequests = 0
let slowVisible = false
let slowTimer = null

/** @type {{ label: string } | null} */
let authOverlay = null

/** @type {Map<string, { percent: number, label?: string }>} */
const uploadProgress = new Map()

function snapshot() {
  return {
    pendingRequests,
    slowVisible,
    authOverlay,
    uploadProgress: Object.fromEntries(uploadProgress),
    isUploading: uploadProgress.size > 0,
  }
}

function notify() {
  const state = snapshot()
  listeners.forEach((fn) => {
    try {
      fn(state)
    } catch {
      /* ignore subscriber errors */
    }
  })
}

export function subscribeGlobalLoading(listener) {
  listeners.add(listener)
  listener(snapshot())
  return () => listeners.delete(listener)
}

export function getGlobalLoadingState() {
  return snapshot()
}

export function trackRequestStart() {
  pendingRequests += 1
  if (pendingRequests === 1) {
    if (typeof window !== 'undefined') {
      slowTimer = window.setTimeout(() => {
        slowVisible = true
        notify()
      }, 500)
    }
  }
  notify()
}

export function trackRequestEnd() {
  pendingRequests = Math.max(0, pendingRequests - 1)
  if (pendingRequests === 0) {
    if (slowTimer != null && typeof window !== 'undefined') {
      window.clearTimeout(slowTimer)
      slowTimer = null
    }
    slowVisible = false
  }
  notify()
}

/** Full-screen overlay during sign-in / sign-out. */
export function setAuthOverlay(label) {
  authOverlay = label ? { label: String(label) } : null
  notify()
}

export function setUploadProgress(id, percent, label) {
  const key = String(id || 'default')
  const p = Math.min(100, Math.max(0, Number(percent) || 0))
  if (p >= 100) {
    uploadProgress.delete(key)
  } else {
    uploadProgress.set(key, { percent: p, label: label ? String(label) : undefined })
  }
  notify()
}

export function clearUploadProgress(id) {
  uploadProgress.delete(String(id || 'default'))
  notify()
}
