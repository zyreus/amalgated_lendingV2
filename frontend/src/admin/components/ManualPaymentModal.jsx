import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Banknote,
  Building2,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  Receipt,
  Search,
  Smartphone,
  User,
  Wallet,
  X,
} from 'lucide-react'
import { admin } from './AdminUi.jsx'
import { LOAN_TYPE_META } from '../../borrower/components/LoanApplicationUi.jsx'

const STEPS = [
  { id: 1, title: 'Account & loan', description: 'Pick borrower and active loan' },
  { id: 2, title: 'Payment details', description: 'Amount, date, and method' },
  { id: 3, title: 'Receipt & review', description: 'OR/AR numbers and confirm' },
]

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 28 : -28, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -28 : 28, opacity: 0 }),
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, hint: 'Over-the-counter' },
  { value: 'gcash', label: 'GCash', icon: Smartphone, hint: 'Mobile wallet' },
  { value: 'bank', label: 'Bank Transfer', icon: Building2, hint: 'Deposit or wire' },
]

const PAYMENT_TYPES = [
  { value: 'partial', label: 'Partial', hint: 'Less than installment balance' },
  { value: 'full', label: 'Full', hint: 'Covers selected installment' },
  { value: 'advance', label: 'Advance', hint: 'Early or excess payment' },
]

function Field({ label, hint, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={`text-[11px] font-semibold uppercase tracking-wide ${admin.textMuted}`}>
        {label}
        {required ? <span className="ml-0.5 text-brand-primary">*</span> : null}
      </span>
      {hint ? <span className={`mt-0.5 block text-xs font-normal normal-case tracking-normal ${admin.textMuted}`}>{hint}</span> : null}
      <div className="mt-2">{children}</div>
    </label>
  )
}

function LoanTypeBadge({ loanType, label }) {
  const meta = LOAN_TYPE_META[loanType] || {}
  const Icon = meta.icon || Wallet
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
      <Icon className="size-3" />
      {label || meta.tag || loanType}
    </span>
  )
}

function StepSidebar({ step, onStepClick }) {
  const currentIndex = STEPS.findIndex((s) => s.id === step)
  const progress = Math.round(((currentIndex + 1) / STEPS.length) * 100)

  return (
    <aside className="relative hidden w-[15.5rem] shrink-0 flex-col overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-5 text-white md:flex lg:w-[17rem]">
      <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 size-28 rounded-full bg-black/10 blur-2xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">Collections</p>
        <h2 className="mt-2 text-lg font-semibold leading-tight">Manual Payment Entry</h2>
        <p className="mt-2 text-xs leading-relaxed text-red-50/85">
          Post a staff-processed payment directly to the borrower ledger.
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
        {STEPS.map((s, index) => {
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
                    done || active ? 'bg-white text-brand-primary' : 'bg-white/15 text-red-100'
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

function LoanCard({ loan, selected, onSelect, disabled, formatPeso, roleLabel }) {
  const meta = LOAN_TYPE_META[loan.loan_type] || {}
  const Icon = meta.icon || Wallet

  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={() => onSelect(String(loan.id))}
      className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
        selected
          ? 'border-brand-primary bg-red-50/70 shadow-md ring-2 ring-brand-primary/20 dark:border-red-500/60 dark:bg-red-950/20'
          : 'border-gray-200 bg-white hover:border-brand-primary/40 hover:shadow-sm dark:border-[#1F2937] dark:bg-[#0F172A]/40 dark:hover:border-red-500/30'
      }`}
    >
      {selected ? (
        <motion.span
          layoutId="manual-loan-check"
          className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand-primary text-white"
        >
          <Check className="size-3.5" strokeWidth={3} />
        </motion.span>
      ) : null}
      <div className="flex items-start gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl transition ${
            selected ? 'bg-brand-primary text-white' : 'bg-brand-primary/10 text-brand-primary group-hover:bg-brand-primary/15'
          }`}
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1 pr-8">
          <p className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
            {loan.loan_number || `LN-${String(loan.id).padStart(6, '0')}`}
          </p>
          <p className="mt-0.5 text-xs font-medium text-gray-700 dark:text-gray-300">
            {loan.loan_type_label || roleLabel(loan.loan_type)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-[#1F2937] dark:text-gray-400">
              {roleLabel(loan.status)}
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Outstanding {formatPeso(loan.outstanding_balance)}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function InstallmentCard({ payment, selected, onSelect, disabled, formatPeso, formatDueDate }) {
  return (
    <motion.button
      type="button"
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      onClick={() => onSelect(String(payment.id))}
      className={`w-full rounded-xl border px-4 py-3 text-left transition disabled:opacity-60 ${
        selected
          ? 'border-brand-primary bg-red-50/60 ring-2 ring-brand-primary/15 dark:border-red-500/50 dark:bg-red-950/20'
          : 'border-gray-200 bg-white hover:border-brand-primary/30 dark:border-[#1F2937] dark:bg-[#111827]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Installment #{payment.installment_no}</p>
          <p className={`mt-0.5 text-xs ${admin.textMuted}`}>Due {formatDueDate(payment.due_date)}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-brand-primary">{formatPeso(payment.remaining_due)}</p>
          <p className={`text-[10px] ${admin.textMuted}`}>balance</p>
        </div>
      </div>
    </motion.button>
  )
}

function PaymentSummaryPanel({
  selectedManualBorrower,
  selectedManualLoan,
  selectedManualPayment,
  manualForm,
  manualNewRemaining,
  formatPeso,
  formatDueDate,
}) {
  if (!selectedManualBorrower) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/90 to-white p-4 dark:border-red-900/30 dark:from-red-950/20 dark:to-[#111827]"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary">Live summary</p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="size-4 text-brand-primary" />
          <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedManualBorrower.name}</span>
        </div>
        {selectedManualLoan ? (
          <div className="flex flex-wrap items-center gap-2">
            <LoanTypeBadge loanType={selectedManualLoan.loan_type} label={selectedManualLoan.loan_type_label} />
            <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
              {selectedManualLoan.loan_number || `LN-${String(selectedManualLoan.id).padStart(6, '0')}`}
            </span>
          </div>
        ) : null}
        {selectedManualPayment ? (
          <>
            <p className={`text-xs ${admin.textMuted}`}>
              Inst. #{selectedManualPayment.installment_no} · due {formatDueDate(selectedManualPayment.due_date)}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0F172A]/50">
                <p className={`text-[10px] uppercase ${admin.textMuted}`}>Paying</p>
                <p className="text-base font-bold text-gray-900 dark:text-gray-100">
                  {formatPeso(Number(manualForm.amount_paid || 0))}
                </p>
              </div>
              <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-[#0F172A]/50">
                <p className={`text-[10px] uppercase ${admin.textMuted}`}>After save</p>
                <p className="text-base font-bold text-brand-primary">{formatPeso(manualNewRemaining)}</p>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </motion.div>
  )
}

export default function ManualPaymentModal({
  open,
  onClose,
  borrowerOptions,
  manualForm,
  setManualForm,
  manualLoans,
  manualLoading,
  manualSaving,
  loadManualOptions,
  changeManualLoan,
  changeManualPayment,
  submitManualPayment,
  selectedManualLoan,
  selectedManualPayment,
  selectedManualBorrower,
  manualRemaining,
  manualNewRemaining,
  formatPeso,
  formatDueDate,
  roleLabel,
}) {
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)
  const [borrowerQuery, setBorrowerQuery] = useState('')

  useEffect(() => {
    if (open) {
      setStep(1)
      setDirection(1)
      setBorrowerQuery('')
    }
  }, [open])

  const filteredBorrowers = useMemo(() => {
    const q = borrowerQuery.trim().toLowerCase()
    if (!q) return borrowerOptions
    return borrowerOptions.filter((b) => String(b.name || '').toLowerCase().includes(q))
  }, [borrowerOptions, borrowerQuery])

  const goToStep = (next) => {
    setDirection(next > step ? 1 : -1)
    setStep(next)
  }

  const canAdvanceStep1 =
    manualForm.borrower_id && manualForm.loan_id && manualForm.payment_id && !manualLoading && manualLoans.length > 0

  const canAdvanceStep2 =
    Number(manualForm.amount_paid) > 0 && Number(manualForm.amount_paid) <= manualRemaining + 0.009

  const handleClose = () => {
    if (manualSaving) return
    onClose()
    setStep(1)
    setBorrowerQuery('')
  }

  if (!open) return null

  return (
    <div
      className={admin.modalOverlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !manualSaving) handleClose()
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`${admin.modalCard} flex max-h-[min(92vh,880px)] max-w-4xl flex-col overflow-hidden p-0`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-payment-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <StepSidebar step={step} onStepClick={goToStep} />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-[#1F2937] sm:px-6">
              <div>
                <p className={admin.modalEyebrow}>Step {step} of {STEPS.length}</p>
                <h3 id="manual-payment-title" className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {STEPS[step - 1]?.title}
                </h3>
                <p className={`mt-1 text-sm ${admin.textMuted}`}>{STEPS[step - 1]?.description}</p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={manualSaving}
                className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:hover:bg-[#1F2937]"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <AnimatePresence mode="wait" custom={direction}>
                {step === 1 ? (
                  <motion.div
                    key="step-1"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="space-y-5"
                  >
                    <Field label="Borrower account" required hint="Search by name, then select the account to load active loans.">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                        <input
                          type="search"
                          value={borrowerQuery}
                          onChange={(e) => setBorrowerQuery(e.target.value)}
                          placeholder="Search borrower…"
                          className={`w-full pl-10 ${admin.input}`}
                          disabled={manualSaving}
                        />
                      </div>
                      <select
                        value={manualForm.borrower_id}
                        onChange={(e) => void loadManualOptions(e.target.value)}
                        className={`mt-2 w-full ${admin.input}`}
                        disabled={manualSaving}
                      >
                        <option value="">Select borrower</option>
                        {filteredBorrowers.map((borrower) => (
                          <option key={borrower.id} value={borrower.id}>
                            {borrower.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    {manualForm.borrower_id ? (
                      <AnimatePresence mode="wait">
                        {manualLoading ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-12 dark:border-[#1F2937]"
                          >
                            <Loader2 className="size-5 animate-spin text-brand-primary" />
                            <span className={`text-sm ${admin.textMuted}`}>Loading active loans…</span>
                          </motion.div>
                        ) : manualLoans.length === 0 ? (
                          <motion.p
                            key="empty"
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200"
                          >
                            This borrower has no active unpaid loan installments available for manual encoding.
                          </motion.p>
                        ) : (
                          <motion.div key="loans" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                            <Field label="Active loan" required hint="Each card shows the loan product type and outstanding balance.">
                              <div className="grid gap-3 sm:grid-cols-2">
                                {manualLoans.map((loan) => (
                                  <LoanCard
                                    key={loan.id}
                                    loan={loan}
                                    selected={String(manualForm.loan_id) === String(loan.id)}
                                    onSelect={changeManualLoan}
                                    disabled={manualSaving}
                                    formatPeso={formatPeso}
                                    roleLabel={roleLabel}
                                  />
                                ))}
                              </div>
                            </Field>

                            {selectedManualLoan ? (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-3"
                              >
                                <Field label="Installment" required hint="Select the schedule row this payment applies to.">
                                  <div className="grid gap-2">
                                    {(selectedManualLoan.payments || []).map((payment) => (
                                      <InstallmentCard
                                        key={payment.id}
                                        payment={payment}
                                        selected={String(manualForm.payment_id) === String(payment.id)}
                                        onSelect={changeManualPayment}
                                        disabled={manualSaving}
                                        formatPeso={formatPeso}
                                        formatDueDate={formatDueDate}
                                      />
                                    ))}
                                  </div>
                                </Field>
                              </motion.div>
                            ) : null}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    ) : null}

                    <PaymentSummaryPanel
                      selectedManualBorrower={selectedManualBorrower}
                      selectedManualLoan={selectedManualLoan}
                      selectedManualPayment={selectedManualPayment}
                      manualForm={manualForm}
                      manualNewRemaining={manualNewRemaining}
                      formatPeso={formatPeso}
                      formatDueDate={formatDueDate}
                    />
                  </motion.div>
                ) : null}

                {step === 2 ? (
                  <motion.div
                    key="step-2"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="space-y-5"
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_min(280px,100%)]">
                      <div className="space-y-5">
                        <Field
                          label="Payment amount"
                          required
                          hint={`Installment balance: ${formatPeso(manualRemaining)}`}
                        >
                          <div className="relative">
                            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                              ₱
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualForm.amount_paid}
                              onChange={(e) => setManualForm((current) => ({ ...current, amount_paid: e.target.value }))}
                              className={`w-full pl-9 text-lg font-semibold ${admin.input}`}
                              disabled={manualSaving}
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={manualSaving || !manualRemaining}
                              onClick={() =>
                                setManualForm((current) => ({
                                  ...current,
                                  amount_paid: String(Number(manualRemaining)),
                                  payment_type: 'full',
                                }))
                              }
                              className="rounded-full border border-brand-primary/30 bg-red-50 px-3 py-1 text-xs font-semibold text-brand-primary transition hover:bg-red-100 disabled:opacity-50 dark:bg-red-950/20"
                            >
                              Pay full balance
                            </button>
                            <button
                              type="button"
                              disabled={manualSaving || !manualRemaining}
                              onClick={() =>
                                setManualForm((current) => ({
                                  ...current,
                                  amount_paid: String(Math.round((Number(manualRemaining) / 2) * 100) / 100),
                                  payment_type: 'partial',
                                }))
                              }
                              className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-[#1F2937] dark:text-gray-300"
                            >
                              Half
                            </button>
                          </div>
                        </Field>

                        <Field label="Payment date" required>
                          <div className="relative">
                            <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                            <input
                              type="date"
                              value={manualForm.payment_date}
                              onChange={(e) => setManualForm((current) => ({ ...current, payment_date: e.target.value }))}
                              className={`w-full pl-10 ${admin.input}`}
                              disabled={manualSaving}
                            />
                          </div>
                        </Field>

                        <Field label="Payment method" required>
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            {PAYMENT_METHODS.map(({ value, label, icon: Icon, hint }) => {
                              const active = manualForm.payment_method === value
                              return (
                                <motion.button
                                  key={value}
                                  type="button"
                                  whileTap={{ scale: 0.98 }}
                                  disabled={manualSaving}
                                  onClick={() => setManualForm((current) => ({ ...current, payment_method: value }))}
                                  className={`rounded-xl border p-3 text-left transition ${
                                    active
                                      ? 'border-brand-primary bg-red-50/70 ring-2 ring-brand-primary/15 dark:bg-red-950/20'
                                      : 'border-gray-200 bg-white hover:border-brand-primary/30 dark:border-[#1F2937] dark:bg-[#111827]'
                                  }`}
                                >
                                  <Icon className={`size-5 ${active ? 'text-brand-primary' : 'text-gray-400'}`} />
                                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                                  <p className={`text-[10px] ${admin.textMuted}`}>{hint}</p>
                                </motion.button>
                              )
                            })}
                          </div>
                        </Field>

                        <Field label="Payment type">
                          <div className="flex flex-wrap gap-2">
                            {PAYMENT_TYPES.map(({ value, label, hint }) => {
                              const active = manualForm.payment_type === value
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  title={hint}
                                  disabled={manualSaving}
                                  onClick={() => setManualForm((current) => ({ ...current, payment_type: value }))}
                                  className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                                    active
                                      ? 'bg-brand-primary text-white shadow-sm'
                                      : 'border border-gray-200 bg-white text-gray-700 hover:border-brand-primary/30 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-200'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </Field>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Penalty amount">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={manualForm.penalty_amount}
                              onChange={(e) => setManualForm((current) => ({ ...current, penalty_amount: e.target.value }))}
                              className={`w-full ${admin.input}`}
                              disabled={manualSaving}
                            />
                          </Field>
                          <Field label="Reference number" hint="GCash trace, bank ref, or internal note">
                            <input
                              value={manualForm.reference_number}
                              onChange={(e) => setManualForm((current) => ({ ...current, reference_number: e.target.value }))}
                              placeholder="Optional reference"
                              className={`w-full ${admin.input}`}
                              disabled={manualSaving}
                            />
                          </Field>
                        </div>
                      </div>

                      <PaymentSummaryPanel
                        selectedManualBorrower={selectedManualBorrower}
                        selectedManualLoan={selectedManualLoan}
                        selectedManualPayment={selectedManualPayment}
                        manualForm={manualForm}
                        manualNewRemaining={manualNewRemaining}
                        formatPeso={formatPeso}
                        formatDueDate={formatDueDate}
                      />
                    </div>
                  </motion.div>
                ) : null}

                {step === 3 ? (
                  <motion.div
                    key="step-3"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="space-y-5"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/80 via-white to-white dark:border-red-900/30 dark:from-red-950/15 dark:to-[#111827]"
                    >
                      <div className="flex items-center gap-3 border-b border-red-100/80 px-4 py-3 dark:border-red-900/20">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                          <Receipt className="size-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Receipt numbers</p>
                          <p className={`text-xs ${admin.textMuted}`}>
                            Leave blank to auto-mint OR/AR. Duplicates are blocked system-wide.
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-4 p-4 sm:grid-cols-2">
                        <Field label="Official Receipt (OR)">
                          <input
                            value={manualForm.official_receipt_number}
                            onChange={(e) =>
                              setManualForm((current) => ({
                                ...current,
                                official_receipt_number: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="OR-2026-0001"
                            className={`w-full font-mono uppercase ${admin.input}`}
                            disabled={manualSaving}
                          />
                        </Field>
                        <Field label="Acknowledgement Receipt (AR)">
                          <input
                            value={manualForm.acknowledgement_receipt_number}
                            onChange={(e) =>
                              setManualForm((current) => ({
                                ...current,
                                acknowledgement_receipt_number: e.target.value.toUpperCase(),
                              }))
                            }
                            placeholder="AR-2026-0001"
                            className={`w-full font-mono uppercase ${admin.input}`}
                            disabled={manualSaving}
                          />
                        </Field>
                      </div>
                    </motion.div>

                    <Field label="Remarks" hint="Optional notes for audit trail and borrower statements.">
                      <textarea
                        rows={3}
                        value={manualForm.notes}
                        onChange={(e) => setManualForm((current) => ({ ...current, notes: e.target.value }))}
                        className={`w-full ${admin.input}`}
                        placeholder="Optional notes for audit and borrower statement context"
                        disabled={manualSaving}
                      />
                    </Field>

                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.08 }}
                      className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-[#1F2937] dark:bg-[#0F172A]/40"
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-brand-primary" />
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review before posting</p>
                      </div>
                      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className={`text-[10px] uppercase ${admin.textMuted}`}>Borrower</dt>
                          <dd className="font-medium">{selectedManualBorrower?.name || '—'}</dd>
                        </div>
                        <div>
                          <dt className={`text-[10px] uppercase ${admin.textMuted}`}>Loan</dt>
                          <dd className="font-medium">
                            {selectedManualLoan?.loan_type_label || '—'}{' '}
                            <span className="font-mono text-xs text-gray-500">
                              ({selectedManualLoan?.loan_number || '—'})
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className={`text-[10px] uppercase ${admin.textMuted}`}>Amount</dt>
                          <dd className="font-bold text-brand-primary">{formatPeso(Number(manualForm.amount_paid || 0))}</dd>
                        </div>
                        <div>
                          <dt className={`text-[10px] uppercase ${admin.textMuted}`}>Method</dt>
                          <dd className="font-medium capitalize">{manualForm.payment_method}</dd>
                        </div>
                      </dl>
                    </motion.div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-[#1F2937] sm:px-6">
              <button
                type="button"
                className={admin.btnSecondary}
                onClick={() => (step === 1 ? handleClose() : goToStep(step - 1))}
                disabled={manualSaving}
              >
                {step === 1 ? (
                  'Cancel'
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <ChevronLeft className="size-4" /> Back
                  </span>
                )}
              </button>

              <div className="flex flex-wrap gap-2">
                {step < 3 ? (
                  <button
                    type="button"
                    className={admin.btnPrimary}
                    disabled={
                      manualSaving ||
                      (step === 1 && !canAdvanceStep1) ||
                      (step === 2 && !canAdvanceStep2)
                    }
                    onClick={() => goToStep(step + 1)}
                  >
                    <span className="inline-flex items-center gap-1">
                      Continue <ChevronRight className="size-4" />
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${admin.btnPrimary} inline-flex items-center gap-2`}
                    onClick={() => void submitManualPayment()}
                    disabled={manualSaving || manualLoading || !canAdvanceStep2}
                  >
                    {manualSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" /> Saving…
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-4" /> Save Manual Payment
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
