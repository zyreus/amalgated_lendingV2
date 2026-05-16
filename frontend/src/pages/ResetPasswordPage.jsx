import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput.jsx'
import { publicLaravelPost } from '../utils/lendingLaravelApi.js'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = useMemo(() => searchParams.get('token') || '', [searchParams])
  const emailParam = useMemo(() => searchParams.get('email') || '', [searchParams])

  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [doneMsg, setDoneMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setDoneMsg('')
    try {
      const res = await publicLaravelPost('/password/reset', {
        token,
        email: emailParam.trim(),
        password,
        password_confirmation: passwordConfirmation,
      })
      setDoneMsg(res.message || 'Password updated.')
      setPassword('')
      setPasswordConfirmation('')
    } catch (err) {
      setErrorMsg(err.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  const missingLink = !token || !emailParam

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Amalgated Lending Inc.</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Set new password</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Choose a new password for your account.
          </p>

          {missingLink ? (
            <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              This page needs a valid reset link from your email. Open the link from the message or request a new reset
              from sign in.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                required
                minLength={8}
              />
              <PasswordInput
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                required
                minLength={8}
              />
              {errorMsg ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                  {errorMsg}
                </p>
              ) : null}
              {doneMsg ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                  {doneMsg}
                </p>
              ) : null}
              <button
                disabled={loading}
                type="submit"
                className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          <p className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/borrower/login" className="text-red-600 transition hover:underline dark:text-red-400">
              Borrower sign in
            </Link>
            <span className="text-gray-300 dark:text-gray-600" aria-hidden>
              |
            </span>
            <Link to="/admin/login" className="text-red-600 transition hover:underline dark:text-red-400">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
