import { useEffect, useState } from 'react'

export const AUTH_LOCKOUT_SECONDS = 30

export function throttleWaitSeconds(err, fallback = AUTH_LOCKOUT_SECONDS) {
  const raw = Number(err?.retry_after ?? err?.body?.retry_after ?? fallback)
  if (!Number.isFinite(raw) || raw <= 0) {
    return Math.min(AUTH_LOCKOUT_SECONDS, Math.max(1, fallback))
  }
  return Math.min(AUTH_LOCKOUT_SECONDS, Math.max(1, Math.ceil(raw)))
}

export function throttleMessage(seconds, kind = 'login') {
  const n = Math.max(0, Number(seconds) || 0)
  if (kind === 'password_reset') {
    if (n <= 0) return 'Too many password reset requests. Please wait before trying again.'
    return `Too many password reset requests. Please wait ${n} second${n === 1 ? '' : 's'} before trying again.`
  }
  if (n <= 0) return 'Too many failed login attempts. Please wait before trying again.'
  return `Too many failed login attempts. Please wait ${n} second${n === 1 ? '' : 's'} before trying again.`
}

export function useAuthThrottleCountdown(kind = 'login') {
  const [retrySeconds, setRetrySeconds] = useState(0)

  useEffect(() => {
    if (retrySeconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setRetrySeconds((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retrySeconds])

  const lockedOut = retrySeconds > 0
  const errorMessage = lockedOut ? throttleMessage(retrySeconds, kind) : ''

  const applyThrottleError = (err) => {
    if (err?.status !== 429) return null
    const wait = throttleWaitSeconds(err)
    setRetrySeconds(wait)
    return throttleMessage(wait, kind)
  }

  const clearThrottleMessage = () => {
    if (retrySeconds <= 0) return
    setRetrySeconds(0)
  }

  return {
    retrySeconds,
    lockedOut,
    errorMessage,
    applyThrottleError,
    clearThrottleMessage,
    setRetrySeconds,
  }
}
