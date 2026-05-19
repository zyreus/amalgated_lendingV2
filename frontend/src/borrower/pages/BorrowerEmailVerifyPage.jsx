import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

/** Laravel origin for signed verify links (matches amalgated-lending-api BORROWER_VERIFY_URL_BASE). */
function borrowerVerifyApiBase() {
  const explicit = (import.meta.env.VITE_BORROWER_VERIFY_URL_BASE || import.meta.env.VITE_API_PROXY_TARGET || '')
    .trim()
    .replace(/\/$/, '')
  if (explicit) return explicit
  const port = import.meta.env.VITE_BACKEND_PORT || '8001'
  return `http://127.0.0.1:${port}`
}

/** Build Laravel verify URL from current path (path-based or legacy query). */
function resolveVerifyTarget() {
  const apiBase = borrowerVerifyApiBase()
  const search = window.location.search || ''
  const pathMatch = window.location.pathname.match(/^\/borrower\/email\/verify\/(\d+)\/([a-f0-9]+)$/i)
  if (pathMatch) {
    return `${apiBase}/borrower/email/verify/${pathMatch[1]}/${pathMatch[2]}${search}`
  }
  if (search && search !== '?') {
    return `${apiBase}/borrower/email/verify${search}`
  }
  return null
}

/**
 * SPA fallback when /borrower/email/verify is served by Vite — completes verification via Laravel JSON.
 */
export default function BorrowerEmailVerifyPage() {
  const [state, setState] = useState({
    phase: 'loading',
    title: 'Verifying your email',
    message: 'Please wait while we confirm your link…',
    loginUrl: '/borrower/login',
  })

  useEffect(() => {
    const loginFallback = '/borrower/login'
    const verifyUrl = resolveVerifyTarget()

    if (!verifyUrl) {
      setState({
        phase: 'error',
        title: 'Invalid link',
        message: 'This verification link is incomplete. Sign in and request a new verification email.',
        loginUrl: loginFallback,
      })
      return
    }

    let cancelled = false
    let redirectTimer

    const finish = (next) => {
      if (cancelled) return
      setState(next)
      if (next.loginUrl && next.phase !== 'loading') {
        redirectTimer = window.setTimeout(() => {
          window.location.replace(next.loginUrl)
        }, 4000)
      }
    }

    const run = async () => {
      try {
        const res = await fetch(verifyUrl, {
          headers: { Accept: 'application/json' },
          credentials: 'omit',
        })
        const data = await res.json().catch(() => ({}))
        const loginUrl =
          typeof data.login_url === 'string' && data.login_url !== '' ? data.login_url : loginFallback
        const message =
          typeof data.message === 'string' && data.message !== ''
            ? data.message
            : res.ok
              ? 'Your email address is verified. You can now sign in.'
              : 'This verification link is invalid or expired.'

        if (data.ok) {
          finish({
            phase: 'ok',
            title: 'Email verified',
            message,
            loginUrl,
          })
          return
        }

        finish({
          phase: 'error',
          title: res.status === 403 ? 'Link invalid or expired' : 'Verification failed',
          message,
          loginUrl,
        })
      } catch {
        window.location.replace(verifyUrl)
      }
    }

    run()

    return () => {
      cancelled = true
      if (redirectTimer) window.clearTimeout(redirectTimer)
    }
  }, [])

  const isOk = state.phase === 'ok'

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Borrower Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{state.title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{state.message}</p>
          {state.phase === 'loading' ? (
            <div className="mt-6 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
              Verifying…
            </div>
          ) : state.loginUrl.startsWith('http') ? (
            <a
              href={state.loginUrl}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Continue to borrower sign in
            </a>
          ) : (
            <Link
              to={state.loginUrl}
              className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Continue to borrower sign in
            </Link>
          )}
          {state.phase !== 'loading' ? (
            <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-500">
              Redirecting automatically in a few seconds…
            </p>
          ) : null}
          <p
            className={`mt-4 inline-block rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
              isOk
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                : state.phase === 'error'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            {state.phase === 'loading' ? 'Working' : isOk ? 'Verified' : 'Action needed'}
          </p>
        </div>
      </div>
    </div>
  )
}
