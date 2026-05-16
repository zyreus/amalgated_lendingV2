import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PasswordInput from '../../components/PasswordInput.jsx'
import { useBorrowerAuth } from '../context/useBorrowerAuth.js'

export default function BorrowerRegisterPage() {
  const navigate = useNavigate()
  const { register } = useBorrowerAuth()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    password_confirmation: '',
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrorMsg('')
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.password_confirmation) {
      setErrorMsg('Password confirmation does not match.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    try {
      await register(form)
      navigate('/borrower/dashboard', { replace: true })
    } catch (err) {
      setErrorMsg(err?.message || 'Could not create borrower account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col page-shell-bg text-gray-900 transition-colors duration-300">
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-xl transition-colors duration-300 dark:border-[#1F2937] dark:bg-[#111827]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#DC2626]">Borrower Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">Create borrower account</h1>
          <p className="mt-2 text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Register to access your loan application dashboard and submit requirements securely.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              required
              placeholder="Full name"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              required
              placeholder="Email address"
              autoComplete="email"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <input
              value={form.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="Contact number (optional)"
              autoComplete="tel"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors duration-300 placeholder:text-gray-500 focus:border-[#DC2626]/50 focus:ring-2 focus:ring-[#DC2626]/20 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-400"
            />
            <PasswordInput
              value={form.password}
              onChange={(e) => onChange('password', e.target.value)}
              required
              placeholder="Password"
              autoComplete="new-password"
            />
            <PasswordInput
              value={form.password_confirmation}
              onChange={(e) => onChange('password_confirmation', e.target.value)}
              required
              placeholder="Confirm password"
              autoComplete="new-password"
            />
            {errorMsg ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{errorMsg}</p>
            ) : null}
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-gray-500 transition-colors duration-300 dark:text-gray-400">
            Already have an account?{' '}
            <Link to="/borrower/login" className="text-red-600 transition hover:text-red-700 hover:underline dark:text-red-400 dark:hover:text-red-300">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

