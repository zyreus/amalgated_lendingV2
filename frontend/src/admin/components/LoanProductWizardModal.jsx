import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Briefcase,
  Check,
  ChevronRight,
  Home,
  Plane,
  Shield,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react'
import { admin } from './AdminUi.jsx'
import LoanProductConfigEditor from './LoanProductConfigEditor.jsx'
import {
  formToCalculatorConfig,
  formToRulesConfig,
  inferFeeProfile,
} from '../utils/loanProductConfigSchema.js'
import { applyPresetToForm, LOAN_PRODUCT_PRESETS } from '../utils/loanProductPresets.js'

const WIZARD_STEPS = [
  { id: 1, title: 'Product type', description: 'Choose a template and basic identity' },
  { id: 2, title: 'Rates & limits', description: 'Interest, term caps, and eligibility' },
  { id: 3, title: 'Collateral & docs', description: 'Security and requirements' },
  { id: 4, title: 'Calculator & fees', description: 'Public calculator and fee formulas' },
  { id: 5, title: 'Review & publish', description: 'Display settings and final check' },
]

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -32 : 32, opacity: 0 }),
}

const PRESET_ICONS = {
  home: Home,
  vehicle: Truck,
  briefcase: Briefcase,
  plane: Plane,
  shield: Shield,
  appliance: ShoppingBag,
}

const TIER_STYLES = {
  green: 'border-emerald-200 bg-emerald-50/80 ring-emerald-500/20 dark:border-emerald-800/40 dark:bg-emerald-950/20',
  blue: 'border-sky-200 bg-sky-50/80 ring-sky-500/20 dark:border-sky-800/40 dark:bg-sky-950/20',
  orange: 'border-amber-200 bg-amber-50/80 ring-amber-500/20 dark:border-amber-800/40 dark:bg-amber-950/20',
}

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className={`block text-xs font-semibold uppercase tracking-wide ${admin.textMuted}`}>{label}</label>
      {children}
      {hint ? <p className={`mt-1 text-[11px] leading-relaxed ${admin.textMuted}`}>{hint}</p> : null}
    </div>
  )
}

function WizardSidebar({ mode, step, onStepClick, productName }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === step)
  const progress = Math.round(((currentIndex + 1) / WIZARD_STEPS.length) * 100)

  return (
    <aside className="relative hidden w-[17rem] shrink-0 flex-col overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-5 text-white lg:flex xl:w-[18.5rem]">
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 size-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">
          {mode === 'new' ? 'New product' : 'Edit product'}
        </p>
        <h2 className="mt-2 text-lg font-semibold leading-tight">
          {productName?.trim() || 'Loan product wizard'}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-red-50/85">
          Step through each section — no JSON required.
        </p>
      </div>
      <div className="relative mt-6">
        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-red-100/80">
          <span>Progress</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
          <motion.div
            className="h-full rounded-full bg-white"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      </div>
      <ol className="relative mt-6 space-y-2">
        {WIZARD_STEPS.map((s, index) => {
          const active = s.id === step
          const done = index < currentIndex
          const clickable = done || active
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick(s.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-default ${
                  active ? 'bg-white/15 shadow-sm' : done ? 'bg-white/5 hover:bg-white/10' : 'opacity-55'
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done ? 'bg-white text-brand-primary' : active ? 'bg-white text-brand-primary' : 'bg-white/15 text-red-100'
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug">{s.title}</span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-red-100/75">{s.description}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

function MobileStepBar({ step }) {
  const current = WIZARD_STEPS.find((s) => s.id === step)
  const index = WIZARD_STEPS.findIndex((s) => s.id === step)
  return (
    <div className="border-b border-gray-100 bg-gray-50/80 px-4 py-3 dark:border-[#1F2937] dark:bg-[#0F172A]/40 lg:hidden">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
        Step {step} of {WIZARD_STEPS.length}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{current?.title}</p>
      <div className="mt-2 flex gap-1">
        {WIZARD_STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-brand-primary' : 'bg-gray-200 dark:bg-[#374151]'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 py-2 last:border-0 dark:border-[#1F2937]">
      <dt className={`text-xs ${admin.textMuted}`}>{label}</dt>
      <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">{value || '—'}</dd>
    </div>
  )
}

export default function LoanProductWizardModal({
  open,
  mode,
  form,
  setForm,
  configState,
  setConfigState,
  saving,
  onClose,
  onSave,
}) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [presetId, setPresetId] = useState('')
  const [stepError, setStepError] = useState('')

  useEffect(() => {
    if (open) {
      setStep(1)
      setDirection(1)
      setStepError('')
      setPresetId('')
    }
  }, [open, mode])

  const goToStep = (next) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
    setStepError('')
  }

  const validateStep = (s) => {
    if (s === 1) {
      if (!form.name?.trim()) return 'Loan name is required.'
      if (!form.slug?.trim()) return 'Slug is required (used in URLs and API).'
    }
    if (s === 2) {
      const rate = Number(form.interest_rate)
      if (form.interest_rate === '' || Number.isNaN(rate) || rate < 0 || rate > 100) {
        return 'Enter a valid interest rate between 0 and 100.'
      }
    }
    return ''
  }

  const onNext = () => {
    const err = validateStep(step)
    if (err) {
      setStepError(err)
      return
    }
    if (step < WIZARD_STEPS.length) goToStep(step + 1)
  }

  const onBack = () => {
    if (step > 1) goToStep(step - 1)
  }

  const applyPreset = (preset) => {
    const { form: nextForm, configState: nextCfg, presetId: pid } = applyPresetToForm(form, preset, mode)
    setForm(nextForm)
    setConfigState(nextCfg)
    setPresetId(pid)
    setStepError('')
  }

  const profile = useMemo(
    () => inferFeeProfile(configState.calculatorConfig, form.slug),
    [configState.calculatorConfig, form.slug],
  )

  const previewCalc = useMemo(
    () => formToCalculatorConfig(configState.calculatorConfig, configState.calcExtra),
    [configState],
  )
  const previewRules = useMemo(
    () => formToRulesConfig(configState.rulesConfig, configState.rulesExtra),
    [configState],
  )

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    const err1 = validateStep(1)
    const err2 = validateStep(2)
    if (err1 || err2) {
      setStepError(err1 || err2)
      goToStep(err1 ? 1 : 2)
      return
    }
    onSave(e)
  }

  return (
    <div
      className={admin.modalOverlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="flex max-h-[min(92vh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827] lg:flex-row"
        role="dialog"
        aria-modal="true"
        aria-labelledby="loan-product-wizard-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <WizardSidebar
          mode={mode}
          step={step}
          productName={form.name}
          onStepClick={(id) => {
            if (id < step) goToStep(id)
            else if (id === step + 1) onNext()
          }}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-[#1F2937] sm:px-6">
            <div>
              <p className={admin.modalEyebrow}>{mode === 'new' ? 'Create product' : 'Update product'}</p>
              <h2 id="loan-product-wizard-title" className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                {WIZARD_STEPS[step - 1]?.title}
              </h2>
              <p className={`mt-0.5 text-sm ${admin.textMuted}`}>{WIZARD_STEPS[step - 1]?.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 dark:border-[#374151] dark:hover:bg-[#1F2937]"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>

          <MobileStepBar step={step} />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {stepError ? (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-200"
                  role="alert"
                >
                  {stepError}
                </motion.div>
              ) : null}

              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  {step === 1 ? (
                    <>
                      {mode === 'new' ? (
                        <div>
                          <p className="mb-3 text-sm font-medium text-gray-800 dark:text-gray-200">
                            Start from a loan type template
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {LOAN_PRODUCT_PRESETS.map((preset) => {
                              const Icon = PRESET_ICONS[preset.icon] || Briefcase
                              const selected = presetId === preset.id
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => applyPreset(preset)}
                                  className={`rounded-xl border p-3 text-left ring-1 transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                                    selected
                                      ? 'border-brand-primary bg-red-50/80 ring-brand-primary/30 dark:bg-red-950/20'
                                      : `border-gray-200 bg-white ring-transparent dark:border-[#374151] dark:bg-[#0F172A]/40 ${TIER_STYLES[preset.tier] || ''}`
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                                      <Icon className="size-5" />
                                    </span>
                                    <span>
                                      <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        {preset.label}
                                      </span>
                                      <span className={`mt-0.5 block text-[11px] ${admin.textMuted}`}>
                                        {preset.short} · {preset.form.interest_rate}% / mo
                                      </span>
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ) : null}

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Loan name" className="sm:col-span-2">
                          <input
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.name}
                            onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                            placeholder="e.g. REM (Real Estate Mortgage)"
                            required
                          />
                        </Field>
                        <Field label="Product code">
                          <input
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.code}
                            onChange={(e) => setForm((s) => ({ ...s, code: e.target.value }))}
                            placeholder="REM"
                          />
                        </Field>
                        <Field label="Slug" hint="URL-safe identifier — do not change after publish unless needed.">
                          <input
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.slug}
                            onChange={(e) => setForm((s) => ({ ...s, slug: e.target.value }))}
                            placeholder="real-estate-mortgage"
                            required
                          />
                        </Field>
                        <Field label="Sort order" className="sm:col-span-2">
                          <input
                            className={`mt-1 w-full max-w-[8rem] ${admin.input}`}
                            value={form.sort_order}
                            onChange={(e) => setForm((s) => ({ ...s, sort_order: e.target.value }))}
                          />
                        </Field>
                        <Field label="Description" className="sm:col-span-2">
                          <textarea
                            className={`mt-1 w-full ${admin.input}`}
                            rows={3}
                            value={form.description}
                            onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                            placeholder="Short summary shown on the public loan products page."
                          />
                        </Field>
                      </div>
                    </>
                  ) : null}

                  {step === 2 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Interest rate (%)" hint="Monthly rate shown to borrowers.">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.interest_rate}
                          onChange={(e) => setForm((s) => ({ ...s, interest_rate: e.target.value }))}
                          inputMode="decimal"
                          required
                        />
                      </Field>
                      <Field label="Rate type">
                        <select
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.rate_type}
                          onChange={(e) => setForm((s) => ({ ...s, rate_type: e.target.value }))}
                        >
                          <option value="monthly">Monthly</option>
                          <option value="fixed">Fixed</option>
                          <option value="annual">Annual</option>
                        </select>
                      </Field>
                      <Field label="Max term (months)">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.max_term}
                          onChange={(e) => setForm((s) => ({ ...s, max_term: e.target.value }))}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Max loan amount (PHP)">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.max_amount}
                          onChange={(e) => setForm((s) => ({ ...s, max_amount: e.target.value }))}
                          inputMode="decimal"
                        />
                      </Field>
                      <Field label="Age limit">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.age_limit}
                          onChange={(e) => setForm((s) => ({ ...s, age_limit: e.target.value }))}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Safe age" hint="Preferred max age for standard terms.">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.safe_age}
                          onChange={(e) => setForm((s) => ({ ...s, safe_age: e.target.value }))}
                          inputMode="numeric"
                        />
                      </Field>
                      <Field label="Downpayment note" className="sm:col-span-2" hint="Optional text, e.g. 15% of SRP.">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.downpayment}
                          onChange={(e) => setForm((s) => ({ ...s, downpayment: e.target.value }))}
                        />
                      </Field>
                    </div>
                  ) : null}

                  {step === 3 ? (
                    <div className="space-y-4">
                      <Field label="Collateral (display label)">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.collateral}
                          onChange={(e) => setForm((s) => ({ ...s, collateral: e.target.value }))}
                          placeholder="Title, OR/CR, ATM Card…"
                        />
                      </Field>
                      <Field label="Collateral type (internal)">
                        <input
                          className={`mt-1 w-full ${admin.input}`}
                          value={form.collateral_type}
                          onChange={(e) => setForm((s) => ({ ...s, collateral_type: e.target.value }))}
                        />
                      </Field>
                      <Field label="Requirements" hint="Shown to borrowers — comma or sentence list.">
                        <textarea
                          className={`mt-1 w-full ${admin.input}`}
                          rows={4}
                          value={form.requirements}
                          onChange={(e) => setForm((s) => ({ ...s, requirements: e.target.value }))}
                          placeholder="Valid ID, proof of income, …"
                        />
                      </Field>
                    </div>
                  ) : null}

                  {step === 4 ? (
                    <LoanProductConfigEditor
                      embedded
                      slug={form.slug}
                      calculatorConfig={configState.calculatorConfig}
                      rulesConfig={configState.rulesConfig}
                      calcExtra={configState.calcExtra}
                      rulesExtra={configState.rulesExtra}
                      onCalculatorChange={(calculatorConfig) =>
                        setConfigState((s) => ({ ...s, calculatorConfig }))
                      }
                      onRulesChange={(rulesConfig) => setConfigState((s) => ({ ...s, rulesConfig }))}
                      onCalcExtraChange={(calcExtra) => setConfigState((s) => ({ ...s, calcExtra }))}
                      onRulesExtraChange={(rulesExtra) => setConfigState((s) => ({ ...s, rulesExtra }))}
                    />
                  ) : null}

                  {step === 5 ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Status">
                          <select
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.status}
                            onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </Field>
                        <Field label="Card tier (public UI)">
                          <select
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.tier}
                            onChange={(e) => setForm((s) => ({ ...s, tier: e.target.value }))}
                          >
                            <option value="green">Green</option>
                            <option value="blue">Blue</option>
                            <option value="orange">Orange</option>
                          </select>
                        </Field>
                        <Field label="Icon key">
                          <input
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.icon_key}
                            onChange={(e) => setForm((s) => ({ ...s, icon_key: e.target.value }))}
                            placeholder="home, vehicle, plane…"
                          />
                        </Field>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Sample monthly pension" hint="For pension products — calculator demo.">
                          <input
                            className={`mt-1 w-full ${admin.input}`}
                            value={form.sample_monthly_pension}
                            onChange={(e) => setForm((s) => ({ ...s, sample_monthly_pension: e.target.value }))}
                          />
                        </Field>
                      </div>
                      <Field label="Sample computation note">
                        <textarea
                          className={`mt-1 w-full ${admin.input}`}
                          rows={2}
                          value={form.sample_computation_note}
                          onChange={(e) => setForm((s) => ({ ...s, sample_computation_note: e.target.value }))}
                        />
                      </Field>

                      <div className={`${admin.insetPanel} mt-2`}>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review summary</p>
                        <dl className="mt-3 divide-y divide-gray-100 dark:divide-[#1F2937]">
                          <ReviewRow label="Name" value={form.name} />
                          <ReviewRow label="Slug" value={form.slug} />
                          <ReviewRow
                            label="Rate"
                            value={
                              form.interest_rate
                                ? `${form.interest_rate}% ${form.rate_type || 'monthly'}`
                                : '—'
                            }
                          />
                          <ReviewRow label="Max term" value={form.max_term ? `${form.max_term} months` : '—'} />
                          <ReviewRow label="Collateral" value={form.collateral} />
                          <ReviewRow label="Fee profile" value={profile || configState.calculatorConfig.fee_profile || '—'} />
                          <ReviewRow label="Status" value={form.status} />
                        </dl>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-semibold text-brand-primary">
                            View saved calculator JSON
                          </summary>
                          <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-white p-2 text-[10px] dark:bg-[#0F172A]">
                            {JSON.stringify({ calculator_config: previewCalc, rules: previewRules }, null, 2)}
                          </pre>
                        </details>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-auto border-t border-gray-100 bg-gray-50/80 px-4 py-4 dark:border-[#1F2937] dark:bg-[#0F172A]/30 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {step > 1 ? (
                  <button type="button" onClick={onBack} disabled={saving} className={admin.btnSecondary}>
                    Back
                  </button>
                ) : (
                  <button type="button" onClick={onClose} disabled={saving} className={admin.btnSecondary}>
                    Cancel
                  </button>
                )}
                {step < WIZARD_STEPS.length ? (
                  <button type="button" onClick={onNext} className={`${admin.btnPrimary} inline-flex items-center gap-1.5`}>
                    Continue
                    <ChevronRight className="size-4" />
                  </button>
                ) : (
                  <button type="submit" disabled={saving} className={admin.btnPrimary}>
                    {mode === 'new' ? 'Create product' : 'Save changes'}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
