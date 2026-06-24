import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, AtSign, KeyRound } from 'lucide-react'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { throttleMessage, useAuthThrottleCountdown } from '../../utils/authThrottleUi.js'

function textInputClass(disabled = false) {
  return `w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151]`
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {hint ? <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p> : null}
      <div className="relative mt-2">{children}</div>
    </div>
  )
}

export default function BorrowerForgotPasswordPage() {
  const navigate = useNavigate()
  const { requestPasswordOtp } = useBorrowerAuth()
  const [identifier, setIdentifier] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const { retrySeconds, lockedOut, applyThrottleError } = useAuthThrottleCountdown('password_reset')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (loading || lockedOut) return
    setLoading(true)
    setErrorMsg('')
    setMessage('')
    try {
      const trimmedIdentifier = identifier.trim()
      const res = await requestPasswordOtp(trimmedIdentifier)
      setMessage(res.message || 'If the account exists, a reset OTP was sent.')
      setTimeout(() => navigate(`/borrower/reset-password?identifier=${encodeURIComponent(trimmedIdentifier)}`), 600)
    } catch (err) {
      const throttleMsg = applyThrottleError(err)
      setErrorMsg(throttleMsg || err.message || 'Request failed.')
    } finally {
      setLoading(false)
    }
  }

  const displayError = lockedOut ? throttleMessage(retrySeconds, 'password_reset') : errorMsg

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="h-1 bg-gradient-to-r from-brand-primary via-red-600 to-[#7F1D1D]" aria-hidden />

          <div className="px-7 py-8 sm:px-8 sm:py-9">
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-brand-primary dark:bg-red-500/10 dark:text-red-300">
                <KeyRound className="size-5" aria-hidden />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-brand-primary">
                  Borrower Portal
                </p>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
                  Forgot password
                </h1>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              Enter your registered email or mobile number. We will send a one-time password so you can set a new password.
            </p>

            <FormLoadingOverlay submitting={loading} label="Sending...">
              <form onSubmit={onSubmit} className="mt-6 space-y-5">
                <Field
                  label="Email or mobile number"
                  hint="Examples: juan@gmail.com, 09171234567, +639171234567"
                >
                  <AtSign
                    className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-brand-primary/80"
                    aria-hidden
                  />
                  <input
                    id="reset_identifier"
                    name="login_identifier"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value)
                      if (!lockedOut) {
                        setErrorMsg('')
                        setMessage('')
                      }
                    }}
                    required
                    placeholder="Enter email or mobile number"
                    inputMode="email"
                    autoComplete="username"
                    disabled={loading || lockedOut}
                    className={textInputClass(loading)}
                  />
                </Field>

                {displayError ? (
                  <p
                    className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
                    role="alert"
                    aria-live="polite"
                  >
                    {displayError}
                  </p>
                ) : null}

                {message ? (
                  <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200">
                    {message}
                  </p>
                ) : null}

                <LoadingButton
                  type="submit"
                  loading={loading}
                  loadingKey="send"
                  disabled={lockedOut}
                  minWidth="100%"
                  className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {lockedOut ? `Try again in ${retrySeconds}s` : 'Send reset OTP'}
                </LoadingButton>
              </form>
            </FormLoadingOverlay>

            <Link
              to="/borrower/login"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 text-sm text-gray-500 transition hover:text-brand-primary dark:text-gray-400"
            >
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
