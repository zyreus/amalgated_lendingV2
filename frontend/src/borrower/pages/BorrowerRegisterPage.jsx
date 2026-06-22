import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { LoadingButton, FormLoadingOverlay } from '../../components/loading'
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

const STEPS = [
  {
    id: 'personal',
    icon: UserRound,
    label: 'Complete borrower identity profile',
    title: 'Personal Information',
    description: 'Tell us who you are so we can build your borrower profile.',
  },
  {
    id: 'contact',
    icon: MapPin,
    label: 'Address and contact validation',
    title: 'Contact and Address',
    description: 'We use these details for verification and loan servicing updates.',
  },
  {
    id: 'security',
    icon: ShieldCheck,
    label: 'OTP-secured account activation',
    title: 'Account Security',
    description: 'Create a strong password, then verify your mobile number with OTP.',
  },
]

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
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

function Field({ label, hint, children, className = '', required = false }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {label}
        {required ? <span className="ml-0.5 text-brand-primary">*</span> : null}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
          {hint}
        </span>
      ) : null}
      <div className="mt-2">{children}</div>
    </label>
  )
}

function FormSection({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gradient-to-b from-gray-50/80 to-white p-5 shadow-sm dark:border-[#1F2937] dark:from-[#0F172A]/40 dark:to-[#111827] sm:p-6">
      <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4 dark:border-[#1F2937]">
        {Icon ? (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
            <Icon className="size-4" />
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function textInputClass() {
  return 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151]'
}

function validateStep(stepIndex, form) {
  if (stepIndex === 0) {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      return 'First name and last name are required.'
    }
    if (!form.date_of_birth) return 'Date of birth is required.'
    if (!form.gender) return 'Please select your gender.'
    return ''
  }
  if (stepIndex === 1) {
    if (!/^(\+?63|0)?9\d{9}$/.test(form.phone.replace(/\s|-/g, ''))) {
      return 'Enter a valid Philippine mobile number.'
    }
    if (!form.email.trim()) return 'Email address is required.'
    if (!form.province.trim() || !form.city.trim() || !form.barangay.trim() || !form.complete_address.trim()) {
      return 'Complete all address fields before continuing.'
    }
    return ''
  }
  if (form.password !== form.password_confirmation) {
    return 'Password confirmation does not match.'
  }
  if (passwordIssues(form.password).some(([, ok]) => !ok)) {
    return 'Password does not meet the security requirements.'
  }
  return ''
}

export default function BorrowerRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { register } = useBorrowerAuth()
  const authHandoff = borrowerAuthHandoffSearchParams(searchParams)
  const [form, setForm] = useState(initialForm)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const formPanelRef = useRef(null)

  const progress = ((step + 1) / STEPS.length) * 100
  const CurrentIcon = STEPS[step].icon

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrorMsg('')
  }

  const goToStep = (nextStep, nextDirection) => {
    if (nextStep < 0 || nextStep >= STEPS.length) return
    setDirection(nextDirection)
    setStep(nextStep)
    setErrorMsg('')
    formPanelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onNext = () => {
    const message = validateStep(step, form)
    if (message) {
      setErrorMsg(message)
      return
    }
    goToStep(step + 1, 1)
  }

  const onBack = () => goToStep(step - 1, -1)

  const onSubmit = async (e) => {
    e.preventDefault()
    const message = validateStep(2, form)
    if (message) {
      setErrorMsg(message)
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
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6 sm:py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[1240px] overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]"
        >
          <div className="grid min-h-[640px] lg:min-h-[680px] lg:grid-cols-[minmax(280px,320px)_minmax(0,1fr)]">
            {/* Left sidebar — landscape panel */}
            <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-6 text-white sm:p-7 lg:p-8">
              <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-white/10 blur-2xl" />

              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">
                  Borrower Portal
                </p>
                <h1 className="mt-3 text-xl font-semibold leading-tight sm:text-2xl">
                  Create your secure lending profile
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-red-50/90">
                  Register with your mobile number, verify by OTP, and manage applications in one dashboard.
                </p>
              </div>

              <div className="relative mt-8 space-y-3.5 lg:mt-10">
                {STEPS.map((item, index) => {
                  const Icon = item.icon
                  const isActive = index === step
                  const isComplete = index < step

                  return (
                    <motion.div
                      key={item.id}
                      layout
                      animate={{
                        scale: isActive ? 1 : 0.98,
                        opacity: isActive || isComplete ? 1 : 0.7,
                      }}
                      transition={{ duration: 0.22 }}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition-colors ${
                        isActive
                          ? 'border-white/30 bg-white/15 shadow-md'
                          : isComplete
                            ? 'border-white/20 bg-white/10'
                            : 'border-transparent bg-white/5'
                      }`}
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                          isComplete
                            ? 'bg-emerald-400/25 text-emerald-100'
                            : isActive
                              ? 'bg-white text-brand-primary'
                              : 'bg-white/10 text-white'
                        }`}
                      >
                        {isComplete ? <Check className="size-4" strokeWidth={2.5} /> : <Icon className="size-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-100/75">
                          Step {index + 1}
                        </p>
                        <p className="text-xs font-medium leading-snug sm:text-sm">{item.label}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              <div className="relative mt-6 lg:mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-red-100/80">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={false}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            </aside>

            {/* Right — multi-step form (landscape) */}
            <FormLoadingOverlay submitting={loading} label="Creating...">
              <form onSubmit={onSubmit} className="flex min-h-[640px] flex-col lg:min-h-[680px]">
                <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-5 py-5 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-7 sm:py-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/10">
                        <CurrentIcon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-primary">
                          Step {step + 1} of {STEPS.length}
                        </p>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                          {STEPS[step].title}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{STEPS[step].description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 lg:hidden">
                      {STEPS.map((item, index) => (
                        <div
                          key={item.id}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            index <= step ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-[#374151]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div
                  ref={formPanelRef}
                  className="flex flex-1 flex-col overflow-y-auto px-5 py-6 sm:px-7 sm:py-8"
                >
                  <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                      key={step}
                      custom={direction}
                      variants={slideVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="flex-1"
                    >
                      {step === 0 ? (
                        <div className="space-y-5">
                          <FormSection
                            title="Legal name"
                            description="Enter your name exactly as it appears on your valid ID."
                            icon={UserRound}
                          >
                            <div className="grid gap-5 sm:grid-cols-3">
                              <Field label="First Name" hint="Given name" required>
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Juan"
                                  value={form.first_name}
                                  onChange={(e) => onChange('first_name', e.target.value)}
                                  autoFocus
                                  required
                                />
                              </Field>
                              <Field label="Middle Name" hint="Optional">
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Santos"
                                  value={form.middle_name}
                                  onChange={(e) => onChange('middle_name', e.target.value)}
                                />
                              </Field>
                              <Field label="Last Name" hint="Family name / surname" required>
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Dela Cruz"
                                  value={form.last_name}
                                  onChange={(e) => onChange('last_name', e.target.value)}
                                  required
                                />
                              </Field>
                            </div>
                          </FormSection>

                          <FormSection
                            title="Identity details"
                            description="Used to verify your profile and comply with lending requirements."
                            icon={BadgeCheck}
                          >
                            <div className="grid gap-5 sm:grid-cols-2">
                              <Field label="Date of Birth" hint="Must match your government ID" required>
                                <input
                                  type="date"
                                  className={textInputClass()}
                                  value={form.date_of_birth}
                                  onChange={(e) => onChange('date_of_birth', e.target.value)}
                                  required
                                />
                              </Field>
                              <Field label="Gender" hint="Used for profile and reporting" required>
                                <select
                                  className={textInputClass()}
                                  value={form.gender}
                                  onChange={(e) => onChange('gender', e.target.value)}
                                  required
                                >
                                  <option value="">Select gender</option>
                                  <option>Female</option>
                                  <option>Male</option>
                                  <option>Prefer not to say</option>
                                </select>
                              </Field>
                            </div>
                          </FormSection>
                        </div>
                      ) : null}

                      {step === 1 ? (
                        <div className="space-y-5">
                          <FormSection
                            title="Contact information"
                            description="We will send OTP and account updates to these details."
                            icon={BadgeCheck}
                          >
                            <div className="grid gap-5 lg:grid-cols-3">
                              <Field label="Phone Number" hint="Philippine mobile — used for OTP" required>
                                <input
                                  className={textInputClass()}
                                  inputMode="tel"
                                  autoComplete="tel"
                                  placeholder="09XX XXX XXXX"
                                  value={form.phone}
                                  onChange={(e) => onChange('phone', e.target.value)}
                                  autoFocus
                                  required
                                />
                              </Field>
                              <Field
                                label="Email Address"
                                hint="For statements and notifications"
                                className="lg:col-span-2"
                                required
                              >
                                <input
                                  type="email"
                                  className={textInputClass()}
                                  autoComplete="email"
                                  placeholder="name@email.com"
                                  value={form.email}
                                  onChange={(e) => onChange('email', e.target.value)}
                                  required
                                />
                              </Field>
                            </div>
                          </FormSection>

                          <FormSection
                            title="Home address"
                            description="Your current residential address for verification and loan servicing."
                            icon={MapPin}
                          >
                            <div className="grid gap-5 sm:grid-cols-3">
                              <Field label="Province" hint="Region / province" required>
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Davao del Sur"
                                  value={form.province}
                                  onChange={(e) => onChange('province', e.target.value)}
                                  required
                                />
                              </Field>
                              <Field label="City / Municipality" required>
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Digos City"
                                  value={form.city}
                                  onChange={(e) => onChange('city', e.target.value)}
                                  required
                                />
                              </Field>
                              <Field label="Barangay" required>
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. Matti"
                                  value={form.barangay}
                                  onChange={(e) => onChange('barangay', e.target.value)}
                                  required
                                />
                              </Field>
                              <Field
                                label="Complete Address"
                                hint="House no., street, subdivision"
                                className="sm:col-span-3"
                                required
                              >
                                <input
                                  className={textInputClass()}
                                  placeholder="e.g. 123 Rizal St., Green Valley Subdivision"
                                  value={form.complete_address}
                                  onChange={(e) => onChange('complete_address', e.target.value)}
                                  required
                                />
                              </Field>
                            </div>
                          </FormSection>
                        </div>
                      ) : null}

                      {step === 2 ? (
                        <div className="mx-auto max-w-3xl space-y-5">
                          <div className="flex items-start gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-200">
                            <BadgeCheck className="mt-0.5 size-5 shrink-0" />
                            <div>
                              <p className="font-semibold">Almost done</p>
                              <p className="mt-1 leading-relaxed text-emerald-800/90 dark:text-emerald-200/90">
                                After creating your account, we will send an OTP to{' '}
                                <span className="font-medium">{form.phone || 'your mobile number'}</span>.
                              </p>
                            </div>
                          </div>

                          <FormSection
                            title="Secure your account"
                            description="Choose a strong password to protect your borrower profile."
                            icon={ShieldCheck}
                          >
                            <div className="grid gap-5 sm:grid-cols-2">
                              <Field label="Password" hint="Minimum 8 characters with mixed case, number & symbol" required>
                                <PasswordInput
                                  value={form.password}
                                  onChange={(e) => onChange('password', e.target.value)}
                                  required
                                  placeholder="Create a strong password"
                                  autoComplete="new-password"
                                  inputClassName="py-3 shadow-sm"
                                />
                              </Field>
                              <Field label="Confirm Password" hint="Re-enter your password" required>
                                <PasswordInput
                                  value={form.password_confirmation}
                                  onChange={(e) => onChange('password_confirmation', e.target.value)}
                                  required
                                  placeholder="Repeat your password"
                                  autoComplete="new-password"
                                  inputClassName="py-3 shadow-sm"
                                />
                              </Field>
                            </div>

                            <div className="mt-5 rounded-xl border border-gray-100 bg-white p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/60">
                              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                Password requirements
                              </p>
                              <div className="grid gap-2.5 sm:grid-cols-2">
                                {passwordIssues(form.password).map(([label, ok]) => (
                                  <p
                                    key={label}
                                    className={`flex items-center gap-2.5 text-sm ${
                                      ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'
                                    }`}
                                  >
                                    <span
                                      className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                                        ok
                                          ? 'bg-emerald-500 text-white'
                                          : 'bg-gray-100 text-gray-400 dark:bg-[#374151]'
                                      }`}
                                    >
                                      {ok ? '✓' : '·'}
                                    </span>
                                    {label}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </FormSection>
                        </div>
                      ) : null}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="mt-auto border-t border-gray-100 bg-gray-50/70 px-5 py-5 dark:border-[#1F2937] dark:bg-[#0F172A]/25 sm:px-7">
                  {errorMsg ? (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300"
                    >
                      {errorMsg}
                    </motion.p>
                  ) : null}

                  <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      {step > 0 ? (
                        <button
                          type="button"
                          onClick={onBack}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:border-[#374151] dark:text-gray-200 dark:hover:bg-[#1F2937]"
                        >
                          <ChevronLeft className="size-4" />
                          Back
                        </button>
                      ) : (
                        <Link
                          to={`/borrower/login${authHandoff}`}
                          className="text-sm text-gray-500 transition hover:text-brand-primary dark:text-gray-400"
                        >
                          Already have an account?
                        </Link>
                      )}
                    </div>

                    {step < STEPS.length - 1 ? (
                      <button
                        type="button"
                        onClick={onNext}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:opacity-60 sm:min-w-[150px]"
                      >
                        Continue
                        <ChevronRight className="size-4" />
                      </button>
                    ) : (
                      <LoadingButton
                        type="submit"
                        loading={loading}
                        loadingKey="create"
                        minWidth="150px"
                        className="rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover sm:min-w-[240px]"
                      >
                        Create account and send OTP
                      </LoadingButton>
                    )}
                  </div>

                  {step > 0 ? (
                    <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400 sm:text-left">
                      Already have an account?{' '}
                      <Link
                        to={`/borrower/login${authHandoff}`}
                        className="font-medium text-brand-primary hover:underline"
                      >
                        Sign in
                      </Link>
                    </p>
                  ) : null}
                </div>
              </form>
            </FormLoadingOverlay>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
