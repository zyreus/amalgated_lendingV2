import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BadgePercent,
  Building2,
  Car,
  Check,
  ChevronRight,
  FileUp,
  Plane,
  Wallet,
} from 'lucide-react'

export const LOAN_TYPE_META = {
  salary: {
    icon: Wallet,
    description: 'For employed borrowers with stable monthly income and payroll-based repayment.',
    tag: 'Employment-based',
  },
  chattel: {
    icon: Car,
    description: 'Finance vehicles, equipment, or movable assets with chattel mortgage security.',
    tag: 'Vehicle collateral',
  },
  real_estate: {
    icon: Building2,
    description: 'Property-backed financing for residential or commercial real estate.',
    tag: 'Property collateral',
  },
  sss_pension: {
    icon: BadgePercent,
    description: 'Tailored for SSS or GSIS pensioners with pension-backed repayment.',
    tag: 'Pension-backed',
  },
  travel_assistance: {
    icon: Plane,
    description: 'Support for travel, deployment, and related pre-departure expenses.',
    tag: 'Travel support',
  },
}

export const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction > 0 ? -32 : 32,
    opacity: 0,
  }),
}

const FIELD_PLACEHOLDERS = {
  full_name: 'e.g. Juan Dela Cruz',
  first_name: 'e.g. Juan',
  middle_name: 'e.g. Santos',
  last_name: 'e.g. Dela Cruz',
  phone: 'e.g. 09171234567',
  email: 'e.g. juan@email.com',
  address: 'House no., street, barangay, city',
  complete_address: 'House no., street, barangay, city',
  property_address: 'Full property location',
  company_address: 'Office or business address',
  term_months: 'e.g. 12',
  monthly_income: 'e.g. 35,000',
  monthly_gross_salary: 'e.g. 45,000',
  monthly_net_salary: 'e.g. 38,000',
  monthly_pension: 'e.g. 15,000',
  loan_amount: 'e.g. 500,000.00',
  loan_purpose: 'Describe how you plan to use the loan',
  destination_country: 'e.g. Japan',
  destination_city: 'e.g. Tokyo',
  plate_number: 'e.g. ABC 1234',
  brand: 'e.g. Toyota',
  model: 'e.g. Vios',
}

const INPUT_INVALID_CLASS =
  'border-[#DC2626] bg-[#FEF2F2] ring-2 ring-[#FECACA]/70 hover:border-[#DC2626] focus:border-[#DC2626] focus:ring-[#FECACA]/80 dark:border-red-500 dark:bg-red-950/30 dark:ring-red-900/40'

export function textInputClass(disabled = false, invalid = false) {
  const base =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151]'
  return `${base} ${invalid ? INPUT_INVALID_CLASS : ''}`
}

export function selectInputClass(invalid = false) {
  return textInputClass(false, invalid)
}

export function fieldPlaceholder(field) {
  if (!field?.key) return ''
  return FIELD_PLACEHOLDERS[field.key] || `Enter ${String(field.label || 'value').toLowerCase()}`
}

export function Field({
  label,
  hint,
  required,
  children,
  className = '',
  fieldKey = '',
  invalid = false,
  errorMessage = '',
  shake = false,
}) {
  return (
    <label
      className={`block ${className}`}
      id={fieldKey ? `wizard-field-${fieldKey}` : undefined}
      data-wizard-field={fieldKey || undefined}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
        {label}
        {required ? <span className="ml-0.5 text-brand-primary">*</span> : null}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-gray-400 dark:text-gray-500">
          {hint}
        </span>
      ) : null}
      <div className={`mt-2 ${shake ? 'animate-wizard-field-shake' : ''}`}>{children}</div>
      {invalid && errorMessage ? (
        <p className="mt-1.5 text-xs font-medium text-[#DC2626] dark:text-red-400" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </label>
  )
}

export function FormSection({ title, description, icon: Icon, children }) {
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

export function LoanTypeSelector({ loanTypes, value, onChange, disabled = false }) {
  const entries = Object.entries(loanTypes || {})

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([key, label]) => {
        const meta = LOAN_TYPE_META[key] || {}
        const Icon = meta.icon || Wallet
        const selected = value === key
        return (
          <motion.button
            key={key}
            type="button"
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            onClick={() => onChange(key)}
            className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-brand-primary bg-red-50/60 shadow-md ring-2 ring-brand-primary/20 dark:border-red-500/60 dark:bg-red-950/20 dark:ring-red-500/20'
                : 'border-gray-200 bg-white hover:border-brand-primary/40 hover:shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:hover:border-red-500/30'
            }`}
          >
            {selected ? (
              <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand-primary text-white">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            ) : null}
            <div
              className={`flex size-11 items-center justify-center rounded-xl transition ${
                selected
                  ? 'bg-brand-primary text-white'
                  : 'bg-gray-100 text-brand-primary group-hover:bg-brand-primary/10 dark:bg-[#0F172A] dark:text-red-300'
              }`}
            >
              <Icon className="size-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
            {meta.tag ? (
              <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-[#0F172A] dark:text-gray-400">
                {meta.tag}
              </span>
            ) : null}
            {meta.description ? (
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{meta.description}</p>
            ) : null}
          </motion.button>
        )
      })}
    </div>
  )
}

export function WizardStepSidebar({
  steps,
  step,
  loanLabel,
  onStepClick,
  allowJump = true,
  stepStatuses = {},
}) {
  const currentIndex = steps.findIndex((s) => Number(s.id) === Number(step))
  const progress = steps.length ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0

  return (
    <aside className="relative flex flex-col overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-5 text-white sm:p-6 lg:min-h-[520px]">
      <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">Loan application</p>
        <h2 className="mt-2 text-lg font-semibold leading-tight sm:text-xl">{loanLabel}</h2>
        <p className="mt-2 text-xs leading-relaxed text-red-50/90">
          Complete each step carefully. Your progress auto-saves as you go.
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

      <ol className="relative mt-6 space-y-2.5">
        {steps.map((s, index) => {
          const stepId = Number(s.id)
          const status = stepStatuses[stepId] || (index < currentIndex ? 'complete' : stepId === Number(step) ? 'current' : 'pending')
          const active = status === 'current'
          const done = status === 'complete'
          const hasError = status === 'error'
          const clickable = allowJump && (done || active || hasError)
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(stepId)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-default ${
                  active
                    ? 'bg-white/15 shadow-sm'
                    : hasError
                      ? 'bg-red-500/20 shadow-sm'
                      : done
                        ? 'bg-white/5 hover:bg-white/10'
                        : 'opacity-60'
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? 'bg-emerald-400/90 text-white'
                      : hasError
                        ? 'bg-red-100 text-[#DC2626]'
                        : active
                          ? 'bg-white text-brand-primary'
                          : 'bg-white/15 text-red-100'
                  }`}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : hasError ? (
                    <AlertTriangle className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug">{s.title}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}

export function WizardStepHeader({ title, description, stepNumber, totalSteps }) {
  return (
    <div className="border-b border-gray-100 bg-gradient-to-r from-white to-gray-50/80 px-5 py-5 dark:border-[#1F2937] dark:from-[#111827] dark:to-[#0F172A]/30 sm:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-primary">
        Step {stepNumber} of {totalSteps}
      </p>
      <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">{title}</h3>
      {description ? <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p> : null}
    </div>
  )
}

export function WizardFooter({ onBack, onNext, backLabel = 'Back', nextLabel = 'Continue', showBack = true, nextDisabled = false }) {
  return (
    <div className="mt-auto border-t border-gray-100 bg-gray-50/70 px-5 py-4 dark:border-[#1F2937] dark:bg-[#0F172A]/25 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-300 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-200"
          >
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {nextLabel}
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function ProductRulesCard({ product }) {
  if (!product) return null
  return (
    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/15 dark:text-emerald-200 md:col-span-2">
      <p className="font-semibold">Product guidelines</p>
      <p className="mt-1 leading-relaxed">
        Collateral: {product.collateral_type || 'Not set'} · Max term: {product.max_term || '—'} months · Max loan:{' '}
        {product.max_amount ? `₱${Number(product.max_amount).toLocaleString()}` : '—'}
      </p>
    </div>
  )
}

export function ComputationCard({ breakdown }) {
  if (!breakdown?.breakdown) return null
  const b = breakdown.breakdown
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm dark:border-emerald-800/50 dark:bg-emerald-900/10 md:col-span-2">
      <p className="font-semibold text-emerald-900 dark:text-emerald-200">Live computation preview</p>
      <div className="mt-2 grid gap-1 text-xs text-emerald-900 dark:text-emerald-200/90 sm:grid-cols-2">
        <p>Monthly amortization: ₱{Number(b.monthly_amortization || 0).toLocaleString()}</p>
        <p>Monthly interest: ₱{Number(b.monthly_interest || 0).toLocaleString()}</p>
        <p>Total miscellaneous: ₱{Number(b.total_miscellaneous_fees || 0).toLocaleString()}</p>
        <p>Net proceeds: ₱{Number(b.net_proceeds || 0).toLocaleString()}</p>
      </div>
    </div>
  )
}

export function DocumentUploadZone({
  docKey,
  meta,
  dragging,
  onDragState,
  onUpload,
  onRemove,
  uploadedItems = [],
  resolveUrl,
  uploading = false,
  uploadProgress = 0,
  canRemove = true,
  maxMb = 20,
  invalid = false,
  errorMessage = '',
  shake = false,
}) {
  const fileCount = uploadedItems?.length || 0
  const uploaded = fileCount > 0
  const multiple = meta?.multiple !== false

  const handleFiles = (fileList) => {
    if (!fileList?.length) return
    const files = multiple ? Array.from(fileList) : [fileList[0]]
    files.forEach((file) => {
      if (file) onUpload(docKey, file)
    })
  }

  return (
    <li
      data-wizard-doc={docKey}
      className={`rounded-2xl border p-4 shadow-sm transition ${
        invalid
          ? 'border-[#FECACA] bg-[#FEF2F2] dark:border-red-800/60 dark:bg-red-950/20'
          : 'border-gray-100 bg-white dark:border-[#1F2937] dark:bg-[#0F172A]/30'
      } ${shake ? 'animate-wizard-field-shake' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{meta.label}</p>
          {invalid && errorMessage ? (
            <p className="mt-1 text-xs font-medium text-[#DC2626] dark:text-red-400" role="alert">
              ⚠ {errorMessage}
            </p>
          ) : null}
          {meta.description ? (
            <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{meta.description}</p>
          ) : null}
          {Array.isArray(meta.accepted) && meta.accepted.length ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Accepted: {meta.accepted.join(' · ')}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {meta.required ? 'Required document' : 'Optional document'}
            {multiple ? ' · Multiple files allowed' : ''}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            uploaded
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          }`}
        >
          {uploaded ? `${fileCount} file${fileCount === 1 ? '' : 's'}` : 'Pending'}
        </span>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          onDragState(docKey)
        }}
        onDragLeave={() => onDragState('')}
        onDrop={(e) => {
          e.preventDefault()
          onDragState('')
          handleFiles(e.dataTransfer?.files)
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
          invalid
            ? 'border-[#DC2626] bg-[#FEF2F2]/80 dark:border-red-500 dark:bg-red-950/30'
            : dragging
              ? 'border-brand-primary bg-red-50/70 dark:border-red-500 dark:bg-red-900/20'
              : 'border-gray-200 bg-gray-50/60 hover:border-brand-primary/40 hover:bg-red-50/30 dark:border-gray-600 dark:bg-[#0F172A]/50'
        }`}
      >
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <FileUp className="mb-2 size-5 text-brand-primary/80" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          Drag & drop or browse{multiple ? ' (multi-select)' : ''}
        </span>
        <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF, JPG, JPEG, or PNG · max {maxMb} MB per file</span>
      </label>
      {uploading ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-300"
              style={{ width: `${Math.min(100, uploadProgress)}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Uploading… {uploadProgress > 0 ? `${uploadProgress}%` : ''}</p>
        </div>
      ) : null}
      {uploaded ? (
        <ul className="mt-3 space-y-2">
          {uploadedItems.map((item, idx) => {
            const url = resolveUrl(item.url || item)
            const path = item.path || null
            const name = item.name || item.original_name || `File ${idx + 1}`
            const isImage = /\.(jpe?g|png)$/i.test(name) || String(item.mime_type || '').startsWith('image/')
            return (
              <li
                key={path || url || idx}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs dark:border-[#1F2937] dark:bg-[#0F172A]/40"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {isImage && url ? (
                    <img src={url} alt="" className="size-10 rounded object-cover" />
                  ) : null}
                  <a href={url} target="_blank" rel="noreferrer" className="truncate font-medium text-brand-primary hover:underline">
                    {name}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <a href={url} target="_blank" rel="noreferrer" className="text-gray-600 hover:underline dark:text-gray-300">
                    Download
                  </a>
                  {canRemove && onRemove && path ? (
                    <button
                      type="button"
                      onClick={() => onRemove(docKey, path)}
                      className="font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

export function AlertBanner({ type = 'error', children }) {
  const styles =
    type === 'success'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
      : type === 'warning'
        ? 'border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-200'
        : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
  return (
    <p className={`rounded-xl px-4 py-3 text-sm ${styles}`} role={type === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  )
}

export function ReviewGrid({ items }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map(({ key, label, value }) => (
        <div key={key} className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function formatEvaluationPeso(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatEvaluationStatus(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'evaluated') return 'Evaluated'
  if (s === 'pending') return 'Pending evaluation'
  return s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Pending evaluation'
}

function formatApprovalStatus(status) {
  const s = String(status || '').toLowerCase().replace(/_/g, '-')
  const map = {
    pending: 'Pending review',
    'for-evaluation': 'For evaluation',
    'under-review': 'Under review',
    'partially-approved': 'Partially approved',
    approved: 'Approved',
    rejected: 'Rejected',
    released: 'Released',
    ongoing: 'Ongoing',
  }
  return map[s] || (status ? String(status).replace(/_/g, ' ') : '—')
}

/** Read-only loan evaluation summary for borrowers after staff review. */
export function LoanEvaluationSummaryCard({ evaluation }) {
  if (!evaluation) return null

  const evaluated = evaluation.status === 'evaluated' || Number(evaluation.approved_loan_amount) > 0

  return (
    <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-800/40 dark:bg-blue-900/15">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Loan evaluation</h4>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {evaluated
          ? 'Your application has been evaluated by our team. Amounts below are read-only.'
          : 'Your application is under review. The final loan amount will be determined after evaluation.'}
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evaluation status</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatEvaluationStatus(evaluation.status)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Approval status</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-100">{formatApprovalStatus(evaluation.approval_status)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Approved loan amount</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatEvaluationPeso(evaluation.approved_loan_amount)}</dd>
        </div>
        {evaluation.evaluated_at ? (
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evaluated on</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{new Date(evaluation.evaluated_at).toLocaleString()}</dd>
          </div>
        ) : null}
        {evaluation.evaluation_remarks ? (
          <div className="sm:col-span-2">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Evaluation remarks</dt>
            <dd className="mt-1 text-sm text-gray-800 dark:text-gray-200">{evaluation.evaluation_remarks}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
