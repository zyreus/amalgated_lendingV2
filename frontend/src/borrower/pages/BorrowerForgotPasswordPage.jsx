import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Smartphone } from 'lucide-react'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'

export default function BorrowerForgotPasswordPage() {
  const navigate = useNavigate()
  const { requestPasswordOtp } = useBorrowerAuth()
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    setMessage('')
    try {
      const res = await requestPasswordOtp(phone.trim())
      setMessage(res.message || 'If the account exists, a reset OTP was sent.')
      setTimeout(() => navigate(`/borrower/reset-password?phone=${encodeURIComponent(phone.trim())}`), 600)
    } catch (err) {
      setErrorMsg(err.message || 'Request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-brand-primary dark:bg-red-500/10 dark:text-red-300">
            <Smartphone className="size-6" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Borrower Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Forgot password</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Enter your registered phone number. We will send a one-time password to continue reset.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="09XXXXXXXXX"
              inputMode="tel"
              autoComplete="tel"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-brand-primary/50 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
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
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset OTP'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            <Link to="/borrower/login" className="text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300">
              Back to sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
