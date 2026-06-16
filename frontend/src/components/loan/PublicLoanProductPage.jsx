import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock3,
  CreditCard,
  FileText,
  HelpCircle,
  Landmark,
  ListChecks,
  PhilippinePeso,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../SubPageHeader.jsx'
import Footer from '../Footer.jsx'
import LoanProductIcon from './LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from './loanProductStyles.js'
import { getLoanProductDocumentList } from './loanProductDocuments.js'
import { PUBLIC_LOAN_PRODUCT_CONFIG } from '../../config/publicLoanProductConfig.js'
import { borrowerLoginApplyPath, borrowerRegisterApplyPath } from '../../utils/borrowerAuthApplyPath.js'

const APPLICATION_STEPS = [
  { step: 1, title: 'Choose Loan Product', body: 'Review product details, loan range, terms, and requirements.' },
  { step: 2, title: 'Submit Application', body: 'Sign in to the Borrower Portal and complete the online form.' },
  { step: 3, title: 'Upload Documents', body: 'Attach IDs, income proof, collateral, or travel documents as required.' },
  { step: 4, title: 'Verification', body: 'Our team validates your information and may contact you for clarification.' },
  { step: 5, title: 'Approval', body: 'Receive approval status and final loan terms after credit review.' },
  { step: 6, title: 'Release of Funds', body: 'Approved funds are released through the agreed disbursement channel.' },
]

const DEFAULT_FAQS = [
  {
    question: 'How accurate is the loan calculator?',
    answer: 'The calculator gives an estimate only. Final monthly payment, fees, and approval terms depend on credit review and complete documents.',
  },
  {
    question: 'Can I apply online?',
    answer: 'Yes. Click Apply Now to sign in or create a borrower account, complete the form, and upload requirements securely.',
  },
  {
    question: 'How fast can my loan be approved?',
    answer: 'Processing starts after complete requirements are submitted. Actual approval time may vary depending on verification and product type.',
  },
  {
    question: 'Will I need additional documents?',
    answer: 'A loan officer may request supporting documents when needed for identity, income, collateral, pension, or travel verification.',
  },
]

function peso(value) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function clampNumber(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function Section({ children, className = '' }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.section>
  )
}

function SectionHeading({ eyebrow, title, body }) {
  return (
    <div className="max-w-2xl">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text dark:text-white">{title}</h2>
      {body ? <p className="mt-2 text-sm leading-relaxed text-brand-text/70 dark:text-white/70">{body}</p> : null}
    </div>
  )
}

function BulletCard({ icon: Icon, title, items, tone = 'emerald' }) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:text-emerald-100'

  return (
    <div className={`rounded-2xl border p-5 ${toneClass}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/75 shadow-sm dark:bg-white/10">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      <ul className="mt-4 grid gap-3 text-sm">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LoanCalculatorCard({ config }) {
  const [amount, setAmount] = useState(String(config.defaultAmount || config.minAmount || 10000))
  const [term, setTerm] = useState(String(config.defaultTerm || config.minTerm || 12))
  const processingFeeRate = config.processingFeeRate ?? 0.03

  const estimate = useMemo(() => {
    const principal = clampNumber(amount, config.minAmount || 1000, config.maxAmount || 1000000)
    const months = Math.round(clampNumber(term, config.minTerm || 1, config.maxTerm || 60))
    const monthlyRate = Number(config.interestRate || 0) / 100
    const interest = principal * monthlyRate * months
    const monthlyPayment = principal / months + principal * monthlyRate
    const processingFee = principal * processingFeeRate
    const totalRepayment = monthlyPayment * months + processingFee
    return { principal, months, interest, monthlyPayment, processingFee, totalRepayment }
  }, [amount, config.interestRate, config.maxAmount, config.maxTerm, config.minAmount, config.minTerm, processingFeeRate, term])

  return (
    <div className="rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-950 sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Loan calculator</p>
          <h3 className="mt-2 text-xl font-semibold text-emerald-950 dark:text-emerald-100">Estimate your monthly payment</h3>
          <p className="mt-2 text-sm text-emerald-900/75 dark:text-emerald-100/70">
            Uses the listed monthly interest rate. Final figures may change after approval.
          </p>
        </div>
        <Calculator className="h-9 w-9 text-emerald-600 dark:text-emerald-300" aria-hidden />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900/70 dark:text-emerald-100/70">Loan Amount</span>
          <input
            type="number"
            min={config.minAmount}
            max={config.maxAmount}
            step="1000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-800 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-emerald-900/70 dark:text-emerald-100/70">Loan Term</span>
          <input
            type="number"
            min={config.minTerm}
            max={config.maxTerm}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-800 dark:bg-slate-950 dark:text-white"
          />
        </label>
      </div>

      <dl className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          ['Estimated Monthly Payment', peso(estimate.monthlyPayment)],
          ['Interest', peso(estimate.interest)],
          ['Processing Fee', peso(estimate.processingFee)],
          ['Total Repayment', peso(estimate.totalRepayment)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/85 p-4 shadow-sm ring-1 ring-emerald-100 dark:bg-slate-950/70 dark:ring-emerald-900/50">
            <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-800/70 dark:text-emerald-200/70">{label}</dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-emerald-950 dark:text-emerald-100">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/**
 * @typedef {object} PublicLoanProductConfig
 * @property {string} slug
 * @property {string} title
 * @property {string} iconKey
 * @property {string} tier
 * @property {string} fallbackRateLabel
 * @property {number} interestRate
 * @property {string} interestRateLabel
 * @property {string} loanAmountRange
 * @property {string} loanTerms
 * @property {string} processingTime
 * @property {string} description
 * @property {{ label: string, value: string, span?: number }[]} infoItems
 * @property {string[]} benefits
 * @property {{ title: string, body: string }[]} features
 * @property {string} productKey
 * @property {string[]} eligibility
 * @property {string[]} requiredDocuments
 */

/**
 * @param {{ config: PublicLoanProductConfig }} props
 */
export default function PublicLoanProductPage({ config }) {
  const documents = config.requiredDocuments?.length ? config.requiredDocuments : getLoanProductDocumentList(config.productKey)
  const relatedProducts = Object.values(PUBLIC_LOAN_PRODUCT_CONFIG)
    .filter((product) => product.slug !== config.slug)
    .slice(0, 3)
  const tier = config.tier || 'blue'
  const applySlug = config.applySlug || config.slug
  const loginPath = borrowerLoginApplyPath(applySlug)
  const registerPath = borrowerRegisterApplyPath(applySlug)

  return (
    <div className="flex min-h-screen flex-col page-shell-bg text-brand-text">
      <SubPageHeader />
      <main className="flex-1">
        <section className="relative overflow-hidden border-b border-brand-secondary/30 bg-gradient-to-br from-white via-brand-background-alt to-emerald-50 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30 sm:py-14">
          <div className="pointer-events-none absolute right-[-8rem] top-[-8rem] h-80 w-80 rounded-full bg-brand-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-10rem] left-[-8rem] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="app-container max-w-6xl">
            <Link to="/loan-products" className="text-sm font-medium text-brand-primary transition hover:underline">
              Back to loan products
            </Link>
            <article className={`relative mt-6 overflow-hidden rounded-3xl border p-5 shadow-xl shadow-black/5 sm:p-8 ${tierCardClass(tier)}`}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tierIconWrapClass(tier)}`}>
                    <LoanProductIcon iconKey={config.iconKey} className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Loan product</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-text dark:text-white sm:text-3xl">
                      {config.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-brand-text/80 dark:text-white/75 sm:text-base">
                      {config.description}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <Link
                    to={loginPath}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
                  >
                    Apply Now
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    to="/contact"
                    className="rounded-xl border border-brand-secondary/50 bg-white/60 px-5 py-3 text-sm font-semibold text-brand-text transition hover:bg-white dark:border-[#374151] dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    Inquire now
                  </Link>
                </div>
              </div>

              <dl className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: 'Interest Rate', value: config.interestRateLabel || config.fallbackRateLabel, icon: Landmark },
                  { label: 'Loan Amount Range', value: config.loanAmountRange, icon: PhilippinePeso },
                  { label: 'Loan Terms', value: config.loanTerms, icon: CreditCard },
                  { label: 'Processing Time', value: config.processingTime, icon: Clock3 },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl border border-white/65 bg-white/75 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/55">
                      <Icon className="h-4 w-4" aria-hidden />
                      {label}
                    </dt>
                    <dd className={`mt-2 text-sm font-semibold ${label === 'Interest Rate' ? tierAccentClass(tier) : 'text-brand-text dark:text-white'}`}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          </div>
        </section>

        <div className="app-container max-w-6xl space-y-14 py-10 sm:py-14">
          <Section>
            <SectionHeading eyebrow="Benefits" title={`Why choose ${config.title}?`} body="Designed for practical Filipino lending needs with clear terms and document-guided processing." />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(config.benefits || []).map((benefit) => (
                <div key={benefit} className="rounded-2xl border border-brand-secondary/25 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
                  <Sparkles className={`h-5 w-5 ${tierAccentClass(tier)}`} aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-brand-text dark:text-white">{benefit}</h3>
                </div>
              ))}
            </div>
          </Section>

          <Section>
            <SectionHeading eyebrow="Features" title="Product features" body="Key financing features, qualification support, and online application capabilities." />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {config.features.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-brand-secondary/25 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]">
                  <BadgeCheck className={`h-5 w-5 ${tierAccentClass(tier)}`} aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold text-brand-text dark:text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text/75 dark:text-white/70">{feature.body}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section className="grid gap-5 lg:grid-cols-2">
            <BulletCard icon={ShieldCheck} title="Eligibility Requirements" items={config.eligibility || []} />
            <BulletCard icon={FileText} title="Required Documents" items={documents} tone="amber" />
          </Section>

          {config.eligiblePurposes?.length ? (
            <Section>
              <SectionHeading eyebrow="Eligible purposes" title="Travel funding purposes" body="Use this loan for qualified travel-related funding needs." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {config.eligiblePurposes.map((purpose) => (
                  <div key={purpose} className="flex items-center gap-3 rounded-2xl border border-brand-secondary/25 bg-white p-4 text-sm font-semibold text-brand-text shadow-sm dark:border-[#1F2937] dark:bg-[#111827] dark:text-white">
                    <WalletCards className={`h-5 w-5 ${tierAccentClass(tier)}`} aria-hidden />
                    {purpose}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          <Section>
            <LoanCalculatorCard config={config} />
          </Section>

          <Section>
            <SectionHeading eyebrow="FAQs" title="Frequently asked questions" body="Quick answers before you start your application." />
            <div className="mt-6 divide-y divide-brand-secondary/25 overflow-hidden rounded-2xl border border-brand-secondary/25 bg-white shadow-sm dark:divide-white/10 dark:border-[#1F2937] dark:bg-[#111827]">
              {(config.faqs || DEFAULT_FAQS).map((faq) => (
                <details key={faq.question} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-brand-text transition hover:bg-black/[0.03] dark:text-white dark:hover:bg-white/5">
                    <span className="flex items-center gap-3">
                      <HelpCircle className={`h-5 w-5 shrink-0 ${tierAccentClass(tier)}`} aria-hidden />
                      {faq.question}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" aria-hidden />
                  </summary>
                  <p className="px-5 pb-5 pl-14 text-sm leading-relaxed text-brand-text/75 dark:text-white/70">{faq.answer}</p>
                </details>
              ))}
            </div>
          </Section>

          <Section>
            <SectionHeading eyebrow="Application process" title="How to apply" body="A simple six-step process from product selection to fund release." />
            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {APPLICATION_STEPS.map((item) => (
                <li key={item.step} className="rounded-2xl border border-brand-secondary/25 bg-white p-5 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-brand-text dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text/75 dark:text-white/70">{item.body}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section className="rounded-3xl bg-brand-dark px-6 py-10 text-center text-white shadow-xl shadow-black/10 sm:text-left">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div>
                <h2 className="text-xl font-semibold">Ready to apply for {config.title}?</h2>
                <p className="mt-2 max-w-xl text-sm text-white/75">
                  Sign in or create a borrower account to start your application, upload requirements, and track status online.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  to={loginPath}
                  className="inline-flex min-w-[10rem] items-center justify-center rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
                >
                  Apply Now
                </Link>
                <Link
                  to={registerPath}
                  className="inline-flex min-w-[10rem] items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Create account
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex min-w-[10rem] items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Inquire now
                </Link>
              </div>
            </div>
          </Section>

          <Section>
            <SectionHeading eyebrow="Related loan products" title="Compare other options" body="Explore similar products before choosing your application path." />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {relatedProducts.map((product) => (
                <Link
                  key={product.slug}
                  to={`/loan-products/${product.slug}`}
                  className="group rounded-2xl border border-brand-secondary/25 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tierIconWrapClass(product.tier)}`}>
                    <LoanProductIcon iconKey={product.iconKey} className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-brand-text dark:text-white">{product.title}</h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-text/70 dark:text-white/65">{product.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-primary">
                    View Details
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              ))}
            </div>
          </Section>

          <Section className="rounded-2xl border border-brand-secondary/30 bg-white p-6 dark:border-[#1F2937] dark:bg-[#111827]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <ListChecks className={`h-5 w-5 ${tierAccentClass(tier)}`} aria-hidden />
                  <h2 className="text-lg font-semibold text-brand-text dark:text-white">Need help before applying?</h2>
                </div>
                <p className="mt-2 text-sm text-brand-text/75 dark:text-white/70">
                  Talk to a loan officer about eligibility, rates, or branch requirements.
                </p>
              </div>
              <Link
                to="/contact"
                className="inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
              >
                Contact us
              </Link>
            </div>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
