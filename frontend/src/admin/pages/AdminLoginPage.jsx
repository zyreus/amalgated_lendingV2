import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { setAuthOverlay } from '../../utils/globalLoadingBus.js'
import PasswordInput from '../../components/PasswordInput.jsx'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'

function throttleMessage(seconds) {
  const n = Math.max(0, Number(seconds) || 0)
  if (n <= 0) return 'Too many failed login attempts. Please wait before trying again.'
  return `Too many failed login attempts. Please wait ${n} second${n === 1 ? '' : 's'} before trying again.`
}

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const { login } = useAdminApiAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [retrySeconds, setRetrySeconds] = useState(0)
  const submittingRef = useRef(false)

  useEffect(() => {
    if (retrySeconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setRetrySeconds((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [retrySeconds])

  useEffect(() => {
    if (retrySeconds > 0) {
      setErrorMsg(throttleMessage(retrySeconds))
    }
  }, [retrySeconds])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading || submittingRef.current || retrySeconds > 0) return

    submittingRef.current = true
    setLoading(true)
    setErrorMsg('')
    setAuthOverlay('Signing In...')

    try {
      await login(username.trim(), password)
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      if (err?.status === 429) {
        const wait = Math.max(1, Number(err?.retry_after ?? err?.body?.retry_after ?? 60))
        setRetrySeconds(wait)
        setErrorMsg(throttleMessage(wait))
      } else {
        setErrorMsg(err.message || 'Admin login failed.')
      }
    } finally {
      setAuthOverlay(null)
      setLoading(false)
      submittingRef.current = false
    }
  }

  const lockedOut = retrySeconds > 0

  return (
    <div className="relative flex min-h-screen flex-col portal-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Admin Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Admin Sign In</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Use your administrator credentials.
          </p>
          <FormLoadingOverlay submitting={loading} label="Signing In...">
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username or email"
              autoComplete="username"
              disabled={loading}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 disabled:opacity-60 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              autoComplete="current-password"
              disabled={loading || lockedOut}
            />
            <div className="flex justify-end">
              <Link
                to="/admin/forgot-password"
                className="text-sm font-medium text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
              >
                Forgot password?
              </Link>
            </div>
            {errorMsg ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300" role="alert">
                {errorMsg}
              </p>
            ) : null}
            <LoadingButton
              type="submit"
              loading={loading}
              loadingKey="signIn"
              disabled={lockedOut}
              minWidth="100%"
              className="w-full rounded-xl bg-[#DC2626] py-3 text-sm font-semibold text-white shadow-md hover:bg-red-700 hover:shadow-lg"
            >
              {lockedOut ? `Try again in ${retrySeconds}s` : 'Sign In'}
            </LoadingButton>
          </form>
          </FormLoadingOverlay>
          <p className="mt-6 text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            <Link to="/borrower/login" className="text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300">
              Borrower Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
