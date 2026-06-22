import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, AtSign, CheckCircle2, LockKeyhole, ShieldCheck } from 'lucide-react'
import { setAuthOverlay } from '../../utils/globalLoadingBus.js'
import PasswordInput from '../../components/PasswordInput.jsx'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import PrivacyPolicyModal from '../../components/privacy/PrivacyPolicyModal.jsx'
import { borrowerAuthHandoffSearchParams } from '../../utils/borrowerAuthApplyPath.js'

function textInputClass() {
  return 'w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151]'
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {label}
      </label>
      {hint ? (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      ) : null}
      <div className="relative mt-2">{children}</div>
    </div>
  )
}

export default function BorrowerLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, loadMe } = useBorrowerAuth()
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)
  const verifiedFlag = searchParams.get('verified') === '1'
  const verifyStatus = (searchParams.get('verification_status') || '').toLowerCase()
  const verifyMessage = searchParams.get('verification_message') || ''
  const authHandoff = borrowerAuthHandoffSearchParams(searchParams)

  useEffect(() => {
    if (verifiedFlag || verifyStatus === 'success' || verifyStatus === 'already_verified') {
      window.dispatchEvent(new Event('lending-borrower-email-verified'))
      void loadMe()
    }
  }, [verifiedFlag, verifyStatus, loadMe])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!privacyAccepted) {
      setErrorMsg('Please accept the Privacy Policy before signing in.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    setAuthOverlay('Signing In...')
    try {
      await login(loginIdentifier.trim(), password, rememberMe)
      const redirect = searchParams.get('redirect')
      const target =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/borrower/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Invalid email/mobile number or password.')
    } finally {
      setAuthOverlay(null)
      setLoading(false)
    }
  }

  const verificationSuccess =
    verifiedFlag || verifyStatus === 'success' || verifyStatus === 'already_verified'
  const verificationMessage =
    verifyMessage ||
    (verificationSuccess
      ? verifyStatus === 'already_verified'
        ? 'This email is already verified. You can sign in normally.'
        : 'Email verified successfully. You can now sign in.'
      : verifyStatus === 'expired'
        ? 'Verification link expired. Sign in and tap resend verification email.'
        : verifyStatus
          ? 'Verification link is invalid. Sign in and request a new verification email.'
          : '')

  const verificationBanner =
    verifiedFlag || verifyStatus ? (
      verificationSuccess ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-700/50 dark:bg-emerald-900/20"
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              <CheckCircle2 className="size-5" strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                {verifyStatus === 'already_verified' ? 'Already verified' : 'Email verified'}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-emerald-800 dark:text-emerald-200">
                {verificationMessage}
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200"
          role="alert"
        >
          {verificationMessage}
        </div>
      )
    ) : null

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
                  Borrower Portal
                </p>
                <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">Welcome back</h1>
                <p className="mt-3 text-sm leading-relaxed text-red-50/90">
                  Access your dashboard to track applications, payments, statements, and notifications.
                </p>
              </div>

              <ul className="relative mt-8 space-y-3 text-sm">
                {[
                  'View loan applications and status',
                  'Download statements and receipts',
                  'Manage profile and security settings',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2.5">
                    <ShieldCheck className="size-4 shrink-0 text-red-100" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <p className="relative mt-8 text-sm text-red-50/90">
                New borrower?{' '}
                <Link
                  to={`/borrower/register${authHandoff}`}
                  className="font-semibold text-white underline underline-offset-2 hover:text-red-50"
                >
                  Create account
                </Link>
              </p>
            </aside>

            <FormLoadingOverlay submitting={loading} label="Signing in...">
              <form onSubmit={onSubmit} className="flex min-h-[520px] flex-col lg:min-h-[560px]">
                <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-6 py-6 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-8">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 sm:text-2xl">
                    Borrower sign in
                  </h2>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Use your registered email address or mobile number.
                  </p>
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 sm:px-8 sm:py-7">
                  <div className="mx-auto w-full max-w-md space-y-5">
                    {verificationBanner}

                    <Field
                      label="Email or mobile number"
                      hint="Examples: juan@gmail.com, 09171234567, +639171234567"
                    >
                      <AtSign
                        className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-brand-primary/80"
                        aria-hidden
                      />
                      <input
                        id="login_identifier"
                        name="login_identifier"
                        value={loginIdentifier}
                        onChange={(e) => {
                          setLoginIdentifier(e.target.value)
                          setErrorMsg('')
                        }}
                        required
                        placeholder="Enter email or mobile number"
                        inputMode="email"
                        autoComplete="username"
                        className={textInputClass()}
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
                          setErrorMsg('')
                        }}
                        required
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className="relative"
                        inputClassName="py-3 pl-11 pr-12 shadow-sm"
                      />
                    </Field>

                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm text-gray-600 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="size-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                        />
                        Remember me
                      </label>
                      <Link
                        to="/borrower/forgot-password"
                        className="text-sm font-medium text-brand-primary transition hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 transition-colors hover:border-gray-300 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
                      <input
                        type="checkbox"
                        checked={privacyAccepted}
                        onChange={(e) => {
                          setPrivacyAccepted(e.target.checked)
                          setErrorMsg('')
                        }}
                        className="mt-0.5 size-4 shrink-0 rounded border-gray-300 text-brand-primary focus:ring-brand-primary/30"
                      />
                      <span className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                        I agree to the{' '}
                        <button
                          type="button"
                          onClick={() => setPrivacyModalOpen(true)}
                          className="font-semibold text-brand-primary hover:underline"
                        >
                          Privacy Policy
                        </button>
                        .
                      </span>
                    </label>

                    {errorMsg ? (
                      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                        {errorMsg}
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
                      minWidth="100%"
                      className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
                    >
                      Sign in
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
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
