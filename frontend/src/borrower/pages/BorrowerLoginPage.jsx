import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PasswordInput from '../../components/PasswordInput.jsx'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import PrivacyPolicyModal from '../../components/privacy/PrivacyPolicyModal.jsx'

export default function BorrowerLoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { login } = useBorrowerAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false)

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
      await login(username.trim(), password)
      const redirect = searchParams.get('redirect')
      const target =
        redirect && redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/borrower/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Borrower login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-gray-100 text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Borrower Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Borrower sign in</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Use your borrower account credentials.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username or email"
              autoComplete="username"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Password"
              autoComplete="current-password"
            />
            <div className="flex justify-end">
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
