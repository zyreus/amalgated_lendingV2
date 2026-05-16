import { useState } from 'react'
import { Link } from 'react-router-dom'
import { publicLaravelPost } from '../../utils/lendingLaravelApi.js'

export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setMessage('')
    try {
      const res = await publicLaravelPost('/admin/forgot-password', { email: email.trim() })
      setMessage(res.message || 'Check your email for reset instructions.')
    } catch (err) {
      setErrorMsg(err.message || 'Request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col portal-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Admin Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Forgot password</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Enter your staff account email. If it matches an admin portal user, we will send reset instructions.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            {errorMsg ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
                {errorMsg}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
                {message}
              </p>
            ) : null}
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-[#DC2626] py-3 text-sm font-semibold text-white shadow-md transition hover:bg-red-700 hover:shadow-lg disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            <Link to="/admin/login" className="text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300">
              Back to Admin Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
