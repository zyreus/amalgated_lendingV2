import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { KeyRound } from 'lucide-react'
import PasswordInput from '../../components/PasswordInput.jsx'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'

export default function BorrowerResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const phoneParam = useMemo(() => searchParams.get('phone') || '', [searchParams])
  const { resetPasswordWithOtp } = useBorrowerAuth()
  const [phone, setPhone] = useState(phoneParam)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    if (password !== passwordConfirmation) {
      setErrorMsg('Password confirmation does not match.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      await resetPasswordWithOtp({
        phone: phone.trim(),
        code: code.trim(),
        password,
        password_confirmation: passwordConfirmation,
      })
      navigate('/borrower/dashboard', { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Reset failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8F9FA] text-gray-900 dark:bg-[#0F172A]">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-brand-primary dark:bg-red-500/10 dark:text-red-300">
            <KeyRound className="size-7" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Password Recovery</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Create new password</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Verify the reset OTP and choose a stronger password. You will be signed in automatically.
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
              placeholder="09XXXXXXXXX"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
            />
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit OTP"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
            />
            <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="New password" autoComplete="new-password" />
            <PasswordInput value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} required placeholder="Confirm new password" autoComplete="new-password" />
            {errorMsg ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errorMsg}</p> : null}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60">
              {loading ? 'Updating...' : 'Reset password and sign in'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-gray-500 dark:text-gray-400">
            <Link to="/borrower/login" className="text-brand-primary transition hover:text-brand-primary-hover hover:underline">
              Back to sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
