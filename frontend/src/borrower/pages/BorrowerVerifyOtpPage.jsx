import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ShieldCheck, Smartphone } from 'lucide-react'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'

function normalizeCode(value) {
  return value.replace(/\D/g, '').slice(0, 6)
}

export default function BorrowerVerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialPhone = useMemo(() => searchParams.get('phone') || '', [searchParams])
  const { verifyOtp, requestOtp } = useBorrowerAuth()
  const [phone, setPhone] = useState(initialPhone)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(60)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const id = setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000)
    return () => clearInterval(id)
  }, [cooldown])

  const onVerify = useCallback(async (e) => {
    e?.preventDefault()
    if (!phone.trim()) {
      setErrorMsg('Enter the phone number used during registration.')
      return
    }
    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit OTP.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      await verifyOtp(phone.trim(), code)
      navigate('/borrower/dashboard', { replace: true })
    } catch (err) {
      setErrorMsg(err.message || 'Invalid or expired OTP.')
    } finally {
      setLoading(false)
    }
  }, [code, navigate, phone, verifyOtp])

  useEffect(() => {
    if (code.length !== 6 || loading) return undefined
    const id = setTimeout(() => {
      void onVerify()
    }, 150)
    return () => clearTimeout(id)
  }, [code, loading, onVerify])

  const onResend = async () => {
    if (cooldown > 0 || !phone.trim()) return
    setResending(true)
    setErrorMsg('')
    setMessage('')
    try {
      const res = await requestOtp(phone.trim())
      setMessage(res.message || 'A new OTP was sent.')
      setCooldown(Number(res.cooldown_seconds) || 60)
    } catch (err) {
      setErrorMsg(err.message || 'Could not resend OTP.')
      setCooldown(Number(err?.body?.cooldown_seconds) || 60)
    } finally {
      setResending(false)
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
            <ShieldCheck className="size-7" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">OTP Verification</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Verify your phone</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Enter the 6-digit code sent to your registered phone via SMS. If SMS is unavailable, check your email.
          </p>

          <form onSubmit={onVerify} className="mt-6 space-y-4">
            <div className="relative">
              <Smartphone className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                placeholder="09XXXXXXXXX"
                className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
              />
            </div>
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              required
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit OTP"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-center text-2xl font-semibold tracking-[0.35em] text-gray-900 outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100"
            />
            {errorMsg ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errorMsg}</p> : null}
            {message ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">{message}</p> : null}
            <button disabled={loading} type="submit" className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify account'}
            </button>
          </form>

          <button
            type="button"
            disabled={cooldown > 0 || resending}
            onClick={onResend}
            className="mt-4 w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#1F2937] dark:text-gray-200 dark:hover:bg-[#0F172A]"
          >
            {resending ? 'Sending...' : cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
          </button>

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
