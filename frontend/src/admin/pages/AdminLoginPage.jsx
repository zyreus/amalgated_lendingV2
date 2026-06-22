import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  LayoutDashboard,
  LockKeyhole,
  ShieldAlert,
  UserRound,
} from 'lucide-react'
import { setAuthOverlay } from '../../utils/globalLoadingBus.js'
import PasswordInput from '../../components/PasswordInput.jsx'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { useAdminApiAuth } from '../context/useAdminApiAuth.js'

function throttleMessage(seconds) {
  const n = Math.max(0, Number(seconds) || 0)
  if (n <= 0) return 'Too many failed login attempts. Please wait before trying again.'
  return `Too many failed login attempts. Please wait ${n} second${n === 1 ? '' : 's'} before trying again.`
}

function textInputClass(disabled = false) {
  return `w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151] ${disabled ? '' : ''}`
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p> : null}
      <div className="relative mt-2">{children}</div>
    </div>
  )
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
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[980px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="grid min-h-[520px] lg:min-h-[560px] lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
            <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-7 text-white sm:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-white/10 blur-2xl" />

              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">
                  Admin Portal
                </p>
                <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">Staff sign in</h1>
                <p className="mt-3 text-sm leading-relaxed text-red-50/90">
                  Secure access for authorized personnel to manage lending operations, borrowers, and reports.
                </p>
              </div>

              <ul className="relative mt-8 space-y-3 text-sm">
                {[
                  { icon: LayoutDashboard, text: 'Dashboard, loans, and collections' },
                  { icon: UserRound, text: 'Borrower and user management' },
                  { icon: ShieldAlert, text: 'Restricted to approved admin accounts' },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
                    <Icon className="size-4 shrink-0 text-red-100" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>

              <p className="relative mt-8 text-sm text-red-50/90">
                Not an admin?{' '}
                <Link
                  to="/borrower/login"
                  className="font-semibold text-white underline underline-offset-2 hover:text-red-50"
                >
                  Borrower sign in
                </Link>
              </p>
            </aside>

            <FormLoadingOverlay submitting={loading} label="Signing in...">
              <form onSubmit={handleSubmit} className="flex min-h-[520px] flex-col lg:min-h-[560px]">
                <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-6 py-6 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-8">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary">Admin Portal</p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
                    Admin sign in
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Enter your administrator username or email and password.
                  </p>
                </div>

                <div className="flex flex-1 flex-col justify-center overflow-y-auto px-6 py-6 sm:px-8 sm:py-8">
                  <div className="mx-auto w-full max-w-md space-y-5">
                    <Field label="Username or email" hint="Use the credentials issued by your system administrator">
                      <UserRound
                        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-brand-primary/80"
                        aria-hidden
                      />
                      <input
                        id="admin_username"
                        name="username"
                        value={username}
                        onChange={(e) => {
                          setUsername(e.target.value)
                          if (retrySeconds <= 0) setErrorMsg('')
                        }}
                        required
                        placeholder="Enter username or email"
                        autoComplete="username"
                        disabled={loading || lockedOut}
                        className={textInputClass(loading || lockedOut)}
                      />
                    </Field>

                    <Field label="Password">
                      <LockKeyhole
                        className="pointer-events-none absolute left-3.5 top-1/2 z-10 size-[18px] -translate-y-1/2 text-brand-primary/80"
                        aria-hidden
                      />
                      <PasswordInput
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value)
                          if (retrySeconds <= 0) setErrorMsg('')
                        }}
                        required
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        disabled={loading || lockedOut}
                        className="relative"
                        inputClassName="py-3 pl-11 pr-12 shadow-sm disabled:opacity-60"
                      />
                    </Field>

                    <div className="flex justify-end pt-1">
                      <Link
                        to="/admin/forgot-password"
                        className="text-sm font-medium text-brand-primary transition hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    {errorMsg ? (
                      <p
                        className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
                        role="alert"
                      >
                        {errorMsg}
                      </p>
                    ) : null}

                    {lockedOut ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-200">
                        Account temporarily locked. Please wait {retrySeconds}s before trying again.
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-auto border-t border-gray-100 bg-gray-50/70 px-6 py-5 dark:border-[#1F2937] dark:bg-[#0F172A]/25 sm:px-8">
                  <div className="mx-auto flex w-full max-w-md flex-col gap-4">
                    <LoadingButton
                      type="submit"
                      loading={loading}
                      loadingKey="signIn"
                      disabled={lockedOut}
                      minWidth="100%"
                      className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60"
                    >
                      {lockedOut ? `Try again in ${retrySeconds}s` : 'Sign in'}
                    </LoadingButton>
                    <Link
                      to="/"
                      className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 transition hover:text-brand-primary dark:text-gray-400"
                    >
                      <ArrowLeft className="size-4" />
                      Back to main page
                    </Link>
                  </div>
                </div>
              </form>
            </FormLoadingOverlay>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
