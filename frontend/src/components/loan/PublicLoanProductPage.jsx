import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../SubPageHeader.jsx'
import Footer from '../Footer.jsx'
import LoanProductIcon from './LoanProductIcon.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from './loanProductStyles.js'
import { getLoanProductDocumentList } from './loanProductDocuments.js'
import { getLoanProducts } from '../../utils/loanProductsPublicApi.js'
import { borrowerLoginApplyPath, borrowerRegisterApplyPath } from '../../utils/borrowerAuthApplyPath.js'

const HOW_TO_APPLY_STEPS = [
  {
    step: 1,
    title: 'Create your borrower account',
    body: 'Register or sign in to the Borrower Portal. Verify your email to unlock application features.',
  },
  {
    step: 2,
    title: 'Complete the loan application',
    body: 'Fill in personal, employment, and loan details. Upload requirements and capture signatures securely.',
  },
  {
    step: 3,
    title: 'Submit and track status',
    body: 'Submit for admin review, receive notifications, and monitor progress from your dashboard.',
  },
]

function DocumentIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/**
 * @typedef {object} PublicLoanProductConfig
 * @property {string} slug
 * @property {string} title
 * @property {string} iconKey
 * @property {string} tier
 * @property {string} fallbackRateLabel
 * @property {string} description
 * @property {{ label: string, value: string, span?: number }[]} infoItems
 * @property {{ title: string, body: string }[]} features
 * @property {string} productKey
 * @property {string[]} eligibility
 */

/**
 * @param {{ config: PublicLoanProductConfig }} props
 */
export default function PublicLoanProductPage({ config }) {
  const [rateLabel, setRateLabel] = useState(config.fallbackRateLabel)
  const documents = getLoanProductDocumentList(config.productKey)
  const tier = config.tier || 'blue'
  const loginPath = borrowerLoginApplyPath(config.slug)
  const registerPath = borrowerRegisterApplyPath(config.slug)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await getLoanProducts()
        const p = (rows || []).find((x) => String(x.slug || '').toLowerCase() === config.slug)
        if (!p || cancelled) return
        const rate = Number(p.interest_rate)
        const label = Number.isFinite(rate)
          ? `${rate.toFixed(2)}% ${p.rate_type === 'fixed' ? 'fixed' : 'per month'}`
          : null
        if (label) setRateLabel(label)
      } catch {
        // keep fallback
      }
    })()
    return () => {
      cancelled = true
    }
  }, [config.slug])

  return (
    <div className="flex min-h-screen flex-col page-shell-bg text-brand-text">
      <SubPageHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="border-b border-brand-secondary/30 bg-gradient-to-b from-white to-brand-background-alt py-10 dark:from-slate-900 dark:to-[#0b1120] sm:py-14">
          <div className="app-container max-w-6xl">
            <Link to="/loan-products" className="text-sm font-medium text-brand-primary transition hover:underline">
              ← Loan products
            </Link>
            <article className={`mt-6 rounded-2xl border p-5 sm:p-8 ${tierCardClass(tier)}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tierIconWrapClass(tier)}`}>
                    <LoanProductIcon iconKey={config.iconKey} className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Loan product</p>
                    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-brand-text dark:text-white sm:text-3xl">
                      {config.title}
                    </h1>
                    <p className={`mt-2 text-base font-semibold ${tierAccentClass(tier)}`}>{rateLabel}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Link
                    to={loginPath}
                    className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
                  >
                    Apply now
                  </Link>
                  <Link
                    to="/contact"
                    className="rounded-xl border border-brand-secondary/50 px-4 py-2 text-sm font-semibold text-brand-text transition hover:bg-black/[0.04] dark:border-[#374151] dark:text-white dark:hover:bg-white/5"
                  >
                    Inquire now
                  </Link>
                </div>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-brand-text/80 dark:text-white/75 sm:text-base">
                {config.description}
              </p>
            </article>
          </div>
        </section>

        <div className="app-container max-w-6xl space-y-12 py-10 sm:py-14">
          {/* Loan information */}
          <section aria-labelledby="loan-info-heading">
            <h2 id="loan-info-heading" className="text-lg font-semibold text-brand-text dark:text-white">
              Loan information
            </h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {config.infoItems.map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl border border-brand-secondary/25 bg-white/80 p-4 dark:border-[#1F2937] dark:bg-[#111827]/80 ${
                    item.span === 2 ? 'sm:col-span-2' : ''
                  }`}
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-brand-text dark:text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Features */}
          <section aria-labelledby="loan-features-heading">
            <h2 id="loan-features-heading" className="text-lg font-semibold text-brand-text dark:text-white">
              Loan features
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {config.features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-brand-secondary/25 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <h3 className="text-sm font-semibold text-brand-text dark:text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text/75 dark:text-white/70">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Requirements checklist */}
          <section aria-labelledby="requirements-heading">
            <h2 id="requirements-heading" className="text-lg font-semibold text-brand-text dark:text-white">
              Requirements checklist
            </h2>
            <p className="mt-2 text-sm text-brand-text/70 dark:text-white/65">
              Prepare these documents before you sign in. Uploads are completed inside the Borrower Portal after registration.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {documents.map((line) => (
                <li
                  key={line}
                  className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/25 dark:text-amber-100"
                >
                  <DocumentIcon />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* How to apply */}
          <section aria-labelledby="how-to-apply-heading">
            <h2 id="how-to-apply-heading" className="text-lg font-semibold text-brand-text dark:text-white">
              How to apply
            </h2>
            <ol className="mt-6 grid gap-4 sm:grid-cols-3">
              {HOW_TO_APPLY_STEPS.map((s) => (
                <li
                  key={s.step}
                  className="relative rounded-2xl border border-brand-secondary/25 bg-white p-5 dark:border-[#1F2937] dark:bg-[#111827]"
                >
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-bold text-white">
                    {s.step}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold text-brand-text dark:text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-brand-text/75 dark:text-white/70">{s.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {/* CTA */}
          <section className="rounded-2xl bg-brand-dark px-6 py-10 text-center text-white sm:text-left">
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
                  Apply now
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
          </section>

          {/* Contact */}
          <section className="rounded-2xl border border-brand-secondary/30 bg-white p-6 dark:border-[#1F2937] dark:bg-[#111827]">
            <h2 className="text-lg font-semibold text-brand-text dark:text-white">Need help before applying?</h2>
            <p className="mt-2 text-sm text-brand-text/75 dark:text-white/70">
              Talk to a loan officer about eligibility, rates, or branch requirements.
            </p>
            <Link
              to="/contact"
              className="mt-4 inline-flex rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover"
            >
              Contact us
            </Link>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
