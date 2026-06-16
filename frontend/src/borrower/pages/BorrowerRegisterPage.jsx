import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BadgeCheck, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import PasswordInput from '../../components/PasswordInput.jsx'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'
import { borrowerAuthHandoffSearchParams } from '../../utils/borrowerAuthApplyPath.js'

const initialForm = {
  first_name: '',
  middle_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  phone: '',
  email: '',
  province: '',
  city: '',
  barangay: '',
  complete_address: '',
  password: '',
  password_confirmation: '',
}

function passwordIssues(password) {
  return [
    ['At least 8 characters', password.length >= 8],
    ['Uppercase letter', /[A-Z]/.test(password)],
    ['Lowercase letter', /[a-z]/.test(password)],
    ['Number', /\d/.test(password)],
    ['Special character', /[^A-Za-z0-9]/.test(password)],
  ]
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}

function textInputClass() {
  return 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-500 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400'
}

export default function BorrowerRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useBorrowerAuth()
  const authHandoff = borrowerAuthHandoffSearchParams(searchParams)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrorMsg('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!/^(\+?63|0)?9\d{9}$/.test(form.phone.replace(/\s|-/g, ''))) {
      setErrorMsg('Enter a valid Philippine mobile number.')
      return
    }
    if (form.password !== form.password_confirmation) {
      setErrorMsg('Password confirmation does not match.')
      return
    }
    if (passwordIssues(form.password).some(([, ok]) => !ok)) {
      setErrorMsg('Password does not meet the security requirements.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await register(form)
      navigate(`/borrower/verify-otp?phone=${encodeURIComponent(res.phone || form.phone)}`, { replace: true })
    } catch (err) {
      setErrorMsg(err?.message || 'Could not create borrower account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
            <aside className="bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-red-100">Borrower Portal</p>
              <h1 className="mt-4 text-3xl font-semibold">Create your secure lending profile</h1>
              <p className="mt-3 text-sm leading-6 text-red-50">
                Register with your mobile number, verify by OTP, and manage applications, payments, and notifications in one dashboard.
              </p>
              <div className="mt-8 space-y-4 text-sm">
                {[
                  [UserRound, 'Complete borrower identity profile'],
                  [MapPin, 'Address and contact validation'],
                  [ShieldCheck, 'OTP-secured account activation'],
                ].map(([Icon, label]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                    <Icon className="size-5" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </aside>

            <form onSubmit={onSubmit} className="space-y-6 p-6 sm:p-8">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Borrower registration</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Fields marked by the form are required for verification and loan application readiness.
                </p>
              </div>

              <section className="rounded-2xl border border-gray-100 p-4 dark:border-[#1F2937]">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <UserRound className="size-4 text-brand-primary" /> Personal Information
                </h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="First Name"><input className={textInputClass()} value={form.first_name} onChange={(e) => onChange('first_name', e.target.value)} required /></Field>
                  <Field label="Middle Name"><input className={textInputClass()} value={form.middle_name} onChange={(e) => onChange('middle_name', e.target.value)} /></Field>
                  <Field label="Last Name"><input className={textInputClass()} value={form.last_name} onChange={(e) => onChange('last_name', e.target.value)} required /></Field>
                  <Field label="Date of Birth"><input type="date" className={textInputClass()} value={form.date_of_birth} onChange={(e) => onChange('date_of_birth', e.target.value)} required /></Field>
                  <Field label="Gender">
                    <select className={textInputClass()} value={form.gender} onChange={(e) => onChange('gender', e.target.value)} required>
                      <option value="">Select gender</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Prefer not to say</option>
                    </select>
                  </Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 p-4 dark:border-[#1F2937]">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <BadgeCheck className="size-4 text-[#198754]" /> Contact and Address
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone Number"><input className={textInputClass()} inputMode="tel" autoComplete="tel" placeholder="09XXXXXXXXX" value={form.phone} onChange={(e) => onChange('phone', e.target.value)} required /></Field>
                  <Field label="Email Address"><input type="email" className={textInputClass()} autoComplete="email" value={form.email} onChange={(e) => onChange('email', e.target.value)} required /></Field>
                  <Field label="Province"><input className={textInputClass()} value={form.province} onChange={(e) => onChange('province', e.target.value)} required /></Field>
                  <Field label="City"><input className={textInputClass()} value={form.city} onChange={(e) => onChange('city', e.target.value)} required /></Field>
                  <Field label="Barangay"><input className={textInputClass()} value={form.barangay} onChange={(e) => onChange('barangay', e.target.value)} required /></Field>
                  <Field label="Complete Address"><input className={textInputClass()} value={form.complete_address} onChange={(e) => onChange('complete_address', e.target.value)} required /></Field>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 p-4 dark:border-[#1F2937]">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <ShieldCheck className="size-4 text-brand-primary" /> Account Security
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <PasswordInput value={form.password} onChange={(e) => onChange('password', e.target.value)} required placeholder="Password" autoComplete="new-password" />
                  <PasswordInput value={form.password_confirmation} onChange={(e) => onChange('password_confirmation', e.target.value)} required placeholder="Confirm password" autoComplete="new-password" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {passwordIssues(form.password).map(([label, ok]) => (
                    <p key={label} className={`text-xs ${ok ? 'text-emerald-600' : 'text-gray-500 dark:text-gray-400'}`}>{ok ? 'OK' : '-'} {label}</p>
                  ))}
                </div>
              </section>

            {errorMsg ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errorMsg}</p>
            ) : null}
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-brand-primary py-3 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create account and send OTP'}
            </button>
              <p className="text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
                Already have an account?{' '}
                <Link
                  to={`/borrower/login${authHandoff}`}
                  className="text-brand-primary transition hover:text-brand-primary-hover hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

