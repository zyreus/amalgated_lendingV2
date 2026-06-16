import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PasswordInput from '../../components/PasswordInput.jsx'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import PrivacyPolicyModal from '../../components/privacy/PrivacyPolicyModal.jsx'
import { borrowerAuthHandoffSearchParams } from '../../utils/borrowerAuthApplyPath.js'

export default function BorrowerLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login, loadMe } = useBorrowerAuth()
  const [phone, setPhone] = useState('')
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
      setErrorMsg('Please review and accept the Privacy Policy before signing in.')
      setPrivacyModalOpen(true)
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      await login(phone.trim(), password, rememberMe)
      const redirect = searchParams.get('redirect')
      const target =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/borrower/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      if (err?.body?.verification_required && err?.body?.phone) {
        navigate(`/borrower/verify-otp?phone=${encodeURIComponent(err.body.phone)}`, { replace: true })
        return
      }
      setErrorMsg(err.message || 'Borrower login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Borrower Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Borrower sign in</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Use your borrower account credentials.
          </p>
          {verifiedFlag || verifyStatus ? (
            <div
              className={`mt-4 rounded-xl px-4 py-3 text-sm ${
                verifiedFlag || verifyStatus === 'success' || verifyStatus === 'already_verified'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-700/15 dark:text-emerald-200'
                  : 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-700/15 dark:text-amber-200'
              }`}
            >
              {verifyMessage ||
                (verifiedFlag || verifyStatus === 'success'
                  ? 'Email verified successfully. You can now sign in.'
                  : verifyStatus === 'already_verified'
                    ? 'This email is already verified. You can sign in normally.'
                    : verifyStatus === 'expired'
                      ? 'Verification link expired. Sign in and tap resend verification email.'
                      : 'Verification link is invalid. Sign in and request a new verification email.')}
            </div>
          ) : null}
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-sm text-red-800 dark:text-red-300">
              New borrower?{' '}
              <Link
                to={`/borrower/register${authHandoff}`}
                className="font-semibold underline underline-offset-2 hover:text-red-900 dark:hover:text-red-200"
              >
                Create account
              </Link>
            </p>
          </div>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="Phone number (09XXXXXXXXX)"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              autoComplete="current-password"
            />
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                Remember me
              </label>
              <Link
                to="/borrower/forgot-password"
                className="text-sm font-medium text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300"
              >
                Forgot password?
              </Link>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Privacy Policy</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Review and acknowledge our data privacy policy before accessing your account.
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPrivacyModalOpen(true)}
                      className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400"
                    >
                      View policy
                    </button>
                    <Link
                      to="/privacy-policy"
                      target="_blank"
                      className="text-xs font-semibold text-red-600 underline underline-offset-2 hover:text-red-700 dark:text-red-400"
                    >
                      Open full page
                    </Link>
                  </div>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={privacyAccepted}
                    onChange={(e) => {
                      setPrivacyAccepted(e.target.checked)
                      setErrorMsg('')
                    }}
                    aria-label="Acknowledge Privacy Policy"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full dark:bg-gray-600" />
                </label>
              </div>
            </div>
            {errorMsg ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {errorMsg}
              </p>
            ) : null}
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            <Link to="/" className="text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300">
              Back to main page
            </Link>
          </p>
        </div>
      </div>
      <PrivacyPolicyModal open={privacyModalOpen} onClose={() => setPrivacyModalOpen(false)} />
    </div>
  )
}
