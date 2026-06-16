import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SubPageHeader from '../components/SubPageHeader.jsx'
import Footer from '../components/Footer.jsx'
import LoanProductCard from '../components/loan/LoanProductCard.jsx'
import LoanProductsCalculator from '../components/loan/LoanProductsCalculator.jsx'
import { getLoanProducts } from '../utils/loanProductsPublicApi.js'
import { buildLoanProductDisplayCards } from '../utils/loanProductDisplayCards.js'
import { borrowerLoginApplyPath } from '../utils/borrowerAuthApplyPath.js'

const FILTERS = [
  { value: 'all', label: 'All loan products' },
  { value: 'salary', label: 'Salary' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'pension', label: 'Pension' },
  { value: 'travel', label: 'Travel Assistance' },
]

function productMatchesFilter(product, filter) {
  const slug = String(product.display_slug || product.slug || '').toLowerCase()
  const name = String(product.name || '').toLowerCase()
  if (filter === 'all') return true
  if (filter === 'mortgage') return slug.includes('mortgage') || name.includes('mortgage')
  if (filter === 'pension') return slug.includes('pension') || name.includes('pension')
  return slug.includes(filter) || name.includes(filter)
}

export default function LoanProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

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
  const productCards = useMemo(() => buildLoanProductDisplayCards(products), [products])
  const visibleProductCards = useMemo(() => {
    const term = search.trim().toLowerCase()
    return productCards.filter((product) => {
      if (!productMatchesFilter(product, filter)) return false
      if (!term) return true
      return [
        product.name,
        product.description,
        product.slug,
        product.loanAmountLabel,
        product.termLabel,
        ...(product.features || []),
        ...(product.purposes || []),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [filter, productCards, search])

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

        <div className="app-container space-y-10 py-10 sm:py-14">
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
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/60">
                <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
                  <label className="block text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Search loan products</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search salary, travel, OFW, pension..."
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-text/60 dark:text-white/50">Loan product filter</span>
                    <select
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    >
                      {FILTERS.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {visibleProductCards.length ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {visibleProductCards.map((p) => (
                    <LoanProductCard key={p.id} product={p} />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  No loan products matched your search or filter.
                </p>
              )}
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
                to={borrowerLoginApplyPath('')}
                className="inline-flex min-w-[10rem] items-center justify-center rounded-full bg-brand-primary px-6 py-3 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover"
              >
                Apply now
              </Link>
              <Link
                to="/contact"
                className="inline-flex min-w-[10rem] items-center justify-center rounded-full border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Inquire now
              </Link>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  )
}
