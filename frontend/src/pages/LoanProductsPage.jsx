import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductIcon from '../components/loan/LoanProductIcon.jsx'
import LoanProductsCalculator from '../components/loan/LoanProductsCalculator.jsx'
import EligibilityChecker from '../components/loan/EligibilityChecker.jsx'
import { tierAccentClass, tierCardClass, tierIconWrapClass } from '../components/loan/loanProductStyles.js'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'
import { loanProductApplyPath } from '../utils/loanProductApplyPath.js'

function ProductDetail({ product, onCheckEligibility }) {
  const tier = product.tier || 'blue'
  const rateLabel =
    product.rate_type === 'fixed'
      ? `${Number(product.interest_rate).toFixed(2)}% fixed`
      : `${Number(product.interest_rate).toFixed(2)}% per month`

  return (
    <article
      id={product.slug}
      className={`scroll-mt-24 rounded-2xl border p-5 transition hover:shadow-lg sm:p-8 ${tierCardClass(tier)}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${tierIconWrapClass(tier)}`}>
            <LoanProductIcon iconKey={product.icon_key} className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-brand-text dark:text-white">{product.name}</h2>
            <p className={`mt-1 text-base font-semibold ${tierAccentClass(tier)}`}>{rateLabel}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onCheckEligibility(product)}
            className="rounded-xl border border-brand-primary/40 px-4 py-2 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary/10"
          >
            Check eligibility
          </button>
          <Link
            to={loanProductApplyPath(product.slug)}
            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-brand-primary-hover"
          >
            Apply now
          </Link>
          <Link
            to={`/apply/documents/${encodeURIComponent(product.slug)}`}
            className="rounded-xl border border-red-600/50 bg-red-600/10 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-600/15 dark:text-red-300 dark:hover:bg-red-600/20"
          >
            Document upload
          </Link>
        </div>
      </div>
      {product.description ? (
        <p className="mt-4 text-sm leading-relaxed text-brand-text/80 dark:text-white/75">{product.description}</p>
      ) : null}
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        {product.collateral ? (
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Collateral</dt>
            <dd className="mt-1 text-brand-text dark:text-white">{product.collateral}</dd>
          </div>
        ) : null}
        {product.requirements ? (
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20 sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
              Requirements
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-brand-text dark:text-white">{product.requirements}</dd>
          </div>
        ) : null}
        {product.max_term != null ? (
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Max term</dt>
            <dd className="mt-1 text-brand-text dark:text-white">{product.max_term} months</dd>
          </div>
        ) : null}
        {product.age_limit != null || product.safe_age != null ? (
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Age</dt>
            <dd className="mt-1 text-brand-text dark:text-white">
              {product.safe_age != null ? <>Safe age: {product.safe_age}</> : null}
              {product.safe_age != null && product.age_limit != null ? ' · ' : null}
              {product.age_limit != null ? <>Max: {product.age_limit}</> : null}
            </dd>
          </div>
        ) : null}
        {product.downpayment ? (
          <div className="rounded-xl bg-white/60 p-3 dark:bg-black/20">
            <dt className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">
              Downpayment
            </dt>
            <dd className="mt-1 text-brand-text dark:text-white">{product.downpayment}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  )
}

export default function LoanProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [eligProduct, setEligProduct] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await getLoanProducts()
        if (!cancelled) setProducts(rows || [])
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load loan products.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const sampleProduct = products.find((p) => p.sample_monthly_pension != null) || products.find((p) => p.slug === 'sss-gsis')

  return (
    <div className="flex min-h-screen flex-col page-shell-bg text-brand-text">
      <SubPageHeader />
      <main className="flex-1">
        <section className="border-b border-brand-secondary/30 bg-gradient-to-b from-white to-brand-background-alt py-12 dark:from-slate-900 dark:to-[#0b1120] sm:py-16">
          <div className="app-container max-w-5xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Loan products</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">All loan types</h1>
            <p className="mt-3 max-w-2xl text-sm text-brand-text/75 sm:text-base">
              Compare interest rates, collateral, and terms. Use the loan calculator to estimate amortization. Subject to
              credit approval.
            </p>
            <p className="mt-3 text-xs text-brand-text/70 sm:text-sm">
              By applying for any product, you agree to our{' '}
              <Link to="/privacy-policy" className="font-semibold text-brand-primary underline underline-offset-2 hover:text-brand-primary-hover">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </section>

        <div className="app-container max-w-5xl space-y-10 py-10 sm:py-14">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-2xl bg-black/[0.06] dark:bg-white/[0.06]" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100" role="alert">
              {error}
            </div>
          ) : (
            <div className="space-y-8">
              {products.map((p) => (
                <ProductDetail key={p.id} product={p} onCheckEligibility={setEligProduct} />
              ))}
            </div>
          )}

          {!loading && !error && products.length > 0 ? (
            <section aria-labelledby="calc-heading" className="space-y-4">
              <h2 id="calc-heading" className="text-lg font-semibold text-brand-text dark:text-white">
                Loan calculator
              </h2>
              <LoanProductsCalculator products={products} />
            </section>
          ) : null}

          {sampleProduct?.sample_monthly_pension != null ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
              <h2 className="text-lg font-semibold text-brand-text dark:text-white">Sample computation</h2>
              <p className="mt-2 text-sm text-brand-text/75 dark:text-white/70">
                Example monthly pension:{' '}
                <strong className="text-brand-text dark:text-white">
                  PHP{' '}
                  {Number(sampleProduct.sample_monthly_pension).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </strong>
                {sampleProduct.sample_computation_note ? (
                  <>
                    <br />
                    <span className="mt-2 inline-block">{sampleProduct.sample_computation_note}</span>
                  </>
                ) : null}
              </p>
            </section>
          ) : null}

          <section className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-brand-dark px-6 py-10 text-center text-white sm:flex-row sm:text-left">
            <div>
              <h2 className="text-xl font-semibold">Ready to apply?</h2>
              <p className="mt-2 max-w-xl text-sm text-white/75">
                Start an application or speak with us about eligibility — we’re here to help.
              </p>
              <p className="mt-2 text-xs text-white/80">
                Please review our{' '}
                <Link to="/privacy-policy" className="font-semibold underline underline-offset-2 hover:text-white">
                  Privacy Policy
                </Link>{' '}
                before submitting your application.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/apply"
                className="inline-flex min-w-[10rem] items-center justify-center rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
              >
                Apply now
              </Link>
              <button
                type="button"
                onClick={() => products.length && setEligProduct(products[0])}
                disabled={!products.length}
                className="inline-flex min-w-[10rem] items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Check eligibility
              </button>
            </div>
          </section>
        </div>
      </main>
      <Footer />

      {eligProduct ? (
        <EligibilityChecker product={eligProduct} onClose={() => setEligProduct(null)} />
      ) : null}
    </div>
  )
}
