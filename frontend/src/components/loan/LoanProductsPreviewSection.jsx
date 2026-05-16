import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLoanProducts } from '../../utils/loanProductsPublicApi.js'
import LoanProductCard from './LoanProductCard.jsx'

export default function LoanProductsPreviewSection() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const rows = await getLoanProducts()
        if (!cancelled) setItems((rows || []).slice(0, 3))
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load products.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section id="loan-preview" className="border-t border-red-100/40 bg-transparent py-16 sm:py-20">
      <div className="app-container">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Loan preview</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
              Featured loan products
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-text/75 sm:text-base">
              Explore rates and short descriptions — full details on the loan products page.
            </p>
          </div>
          <Link
            to="/loan-products"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-brand-primary/40 px-5 py-2.5 text-sm font-semibold text-brand-primary transition hover:bg-brand-primary hover:text-white"
          >
            View all products
          </Link>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-2xl border border-black/5 bg-black/[0.04] dark:bg-white/[0.06]"
              />
            ))}
          </div>
        ) : error ? (
          <p className="mt-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            {error}
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => (
              <LoanProductCard key={p.id} product={p} compact showApply={false} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
