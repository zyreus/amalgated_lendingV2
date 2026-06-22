import { motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  FileUp,
  HelpCircle,
  KeyRound,
  LifeBuoy,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

export const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
  }),
}

export const TICKET_CATEGORIES = [
  'Payment Concern',
  'Loan Application',
  'Verification Issue',
  'Technical Problem',
  'Account Recovery',
  'Billing Concern',
  'Document Upload',
  'Other',
]

export const TICKET_CATEGORY_META = {
  'Payment Concern': {
    icon: CreditCard,
    description: 'Payment posting, receipts, or amortization questions.',
    tag: 'Payments',
  },
  'Loan Application': {
    icon: FileText,
    description: 'Application status, requirements, or document follow-up.',
    tag: 'Applications',
  },
  'Verification Issue': {
    icon: ShieldCheck,
    description: 'Email, mobile, or identity verification problems.',
    tag: 'Verification',
  },
  'Technical Problem': {
    icon: Wrench,
    description: 'Portal errors, login issues, or site functionality.',
    tag: 'Technical',
  },
  'Account Recovery': {
    icon: KeyRound,
    description: 'Locked account, password reset, or access recovery.',
    tag: 'Account',
  },
  'Billing Concern': {
    icon: Receipt,
    description: 'Statements, fees, charges, or billing discrepancies.',
    tag: 'Billing',
  },
  'Document Upload': {
    icon: FileUp,
    description: 'Trouble uploading files or missing document records.',
    tag: 'Documents',
  },
  Other: {
    icon: HelpCircle,
    description: 'General questions not covered by other categories.',
    tag: 'General',
  },
}

export const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Critical']

export const PRIORITY_STYLES = {
  Low: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900/30 dark:text-slate-300',
  Medium: 'border-red-200 bg-red-50 text-red-800 ring-1 ring-brand-primary/25 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300',
  High: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  Critical: 'border-red-300 bg-red-100 text-red-900 ring-1 ring-red-400/30 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200',
}

export const CHAT_QUICK_PROMPTS = [
  'I need help with my loan payment',
  'My application status update',
  'I cannot upload a document',
  'Password or login issue',
  'When will I receive a response?',
]

export function textInputClass() {
  return 'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500 dark:hover:border-[#374151]'
}

export function Field({ label, hint, required, children, className = '' }) {
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

export function AlertBanner({ type = 'error', children }) {
  const styles =
    type === 'success'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/20 dark:text-emerald-200'
      : type === 'info'
        ? 'border border-red-100 bg-red-50/80 text-red-900 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-200'
        : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
  return (
    <p className={`rounded-xl px-4 py-3 text-sm ${styles}`} role={type === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  )
}

export function TicketCategorySelector({ value, onChange, disabled = false }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TICKET_CATEGORIES.map((category) => {
        const meta = TICKET_CATEGORY_META[category] || TICKET_CATEGORY_META.Other
        const Icon = meta.icon
        const selected = value === category
        return (
          <motion.button
            key={category}
            type="button"
            disabled={disabled}
            whileHover={disabled ? undefined : { y: -2 }}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            onClick={() => onChange(category)}
            className={`relative overflow-hidden rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
              selected
                ? 'border-brand-primary bg-red-50/60 shadow-md ring-2 ring-brand-primary/20 dark:border-red-500/60 dark:bg-red-950/20'
                : 'border-gray-200 bg-white hover:border-brand-primary/40 dark:border-[#1F2937] dark:bg-[#111827] dark:hover:border-red-500/30'
            }`}
          >
            {selected ? (
              <span className="absolute right-2.5 top-2.5 flex size-5 items-center justify-center rounded-full bg-brand-primary text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
            <div
              className={`flex size-9 items-center justify-center rounded-xl ${
                selected ? 'bg-brand-primary text-white' : 'bg-gray-100 text-brand-primary dark:bg-[#0F172A]'
              }`}
            >
              <Icon className="size-4" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-gray-100">{category}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{meta.description}</p>
          </motion.button>
        )
      })}
    </div>
  )
}

export function PrioritySelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TICKET_PRIORITIES.map((item) => {
        const selected = value === item
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              selected
                ? PRIORITY_STYLES[item]
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-400'
            }`}
          >
            {item}
          </button>
        )
      })}
    </div>
  )
}

export function SupportStepSidebar({ steps, step, title, subtitle, onStepClick }) {
  const currentIndex = steps.findIndex((s) => s.id === step)
  const progress = steps.length ? Math.round(((currentIndex + 1) / steps.length) * 100) : 0

  return (
    <aside className="relative flex flex-col overflow-hidden bg-gradient-to-br from-brand-primary via-red-700 to-[#7F1D1D] p-5 text-white sm:p-6 lg:min-h-[480px]">
      <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-red-100/90">Support</p>
        <h2 className="mt-2 text-lg font-semibold leading-tight sm:text-xl">{title}</h2>
        {subtitle ? <p className="mt-2 text-xs leading-relaxed text-red-50/90">{subtitle}</p> : null}
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
          const active = s.id === step
          const done = index < currentIndex
          const clickable = done || active
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(s.id)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition disabled:cursor-default ${
                  active ? 'bg-white/15 shadow-sm' : done ? 'bg-white/5 hover:bg-white/10' : 'opacity-60'
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    done
                      ? 'bg-emerald-400/90 text-white'
                      : active
                        ? 'bg-white text-brand-primary'
                        : 'bg-white/15 text-red-100'
                  }`}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold leading-snug">{s.title}</span>
                  {s.description ? (
                    <span className="mt-0.5 block text-[10px] leading-snug text-red-100/80">{s.description}</span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </aside>
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

export function ChatMessageBubble({ message, isBorrower }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
        isBorrower
          ? 'ml-auto rounded-tr-md bg-brand-primary text-white'
          : 'rounded-tl-md bg-white text-gray-800 ring-1 ring-gray-200 dark:bg-[#1F2937] dark:text-gray-200 dark:ring-[#374151]'
      }`}
    >
      {message.message ? <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p> : null}
      {message.attachment_url ? (
        <a
          href={message.attachment_url}
          target="_blank"
          rel="noreferrer"
          className={`mt-1.5 inline-flex items-center gap-1 text-xs underline ${
            isBorrower ? 'text-white/90' : 'text-brand-primary'
          }`}
        >
          {message.attachment_name || 'View attachment'}
        </a>
      ) : null}
      <p className={`mt-1.5 text-[10px] ${isBorrower ? 'text-right text-white/70' : 'text-gray-500 dark:text-gray-400'}`}>
        {message.timeLabel}
      </p>
    </motion.div>
  )
}

export function SupportInfoPanel({ onQuickPrompt }) {
  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-red-50 text-brand-primary dark:bg-red-900/40 dark:text-red-300">
          <LifeBuoy className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Live support</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400">● Team available during business hours</p>
        </div>
      </div>

      <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 text-xs leading-relaxed text-red-900 dark:border-red-800/40 dark:bg-red-950/20 dark:text-red-200">
        Average first response under <strong>10 minutes</strong> during business hours. Attach screenshots or PDFs if helpful.
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Quick prompts</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CHAT_QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onQuickPrompt(prompt)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-left text-xs text-gray-700 transition hover:border-brand-primary/40 hover:text-brand-primary dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-300"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3 dark:border-[#1F2937] dark:bg-[#0F172A]/40">
        <div className="flex items-start gap-2">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-brand-primary" />
          <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            Need async follow-up? Open a support ticket from the Tickets page — we will reply in CRM and here.
          </p>
        </div>
      </div>
    </div>
  )
}
