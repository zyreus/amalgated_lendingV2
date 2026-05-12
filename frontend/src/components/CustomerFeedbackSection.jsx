import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { laravelRequest } from '../utils/lendingLaravelApi.js'

const GRID_LIMIT = 6

function Stars({ value }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= value ? 'text-amber-400' : 'text-gray-200'} aria-hidden>
          ★
        </span>
      ))}
    </div>
  )
}

function TestimonialCard({ item, index, reduceMotion }) {
  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-32px' }}
      transition={{ duration: 0.4, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.05 }}
      className="group flex min-h-[280px] flex-col rounded-2xl border border-black/[0.08] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.03] transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-start justify-between gap-3">
        <Stars value={item.rating} />
        {item.verified ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/90">
            <span aria-hidden>✓</span>
            Verified borrower
          </span>
        ) : (
          <span className="shrink-0 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-500 ring-1 ring-gray-200/80">
            Borrower
          </span>
        )}
      </div>

      <p className="mt-5 flex-1 text-[15px] leading-relaxed text-brand-text/90 sm:text-sm">{item.comment}</p>

      <div className="mt-6 border-t border-black/[0.06] pt-4">
        <p className="text-sm font-semibold tracking-tight text-brand-text">{item.name}</p>
        <p className="mt-0.5 text-xs font-medium text-brand-text/55">{item.loanType}</p>
      </div>
    </motion.article>
  )
}

export default function CustomerFeedbackSection() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ review_count: 0, rating_value: null })
  const [loadState, setLoadState] = useState('loading')
  const reduceMotion = useReducedMotion()

  const gridItems = useMemo(() => items.slice(0, GRID_LIMIT), [items])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadState('loading')
      const { res } = await laravelRequest('/public/website/testimonials?limit=12', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (cancelled) return

      if (!res?.ok) {
        setLoadState('error')
        setItems([])
        setMeta({ review_count: 0, rating_value: null })
        return
      }

      const body = await res.json().catch(() => ({}))
      const rows = Array.isArray(body?.data) ? body.data : []
      const reviewCount = Number(body?.meta?.review_count)
      const ratingValue = body?.meta?.rating_value

      const mapped = rows
        .map((d) => ({
          id: `api-${d.id}`,
          name: String(d.display_name || 'Verified borrower').trim() || 'Verified borrower',
          loanType: String(d.loan_type || 'Borrower').trim() || 'Borrower',
          rating: Math.min(5, Math.max(1, Number(d.rating) || 5)),
          comment: String(d.message || '').trim(),
          verified: !!(d.verified_borrower || d.verified),
        }))
        .filter((x) => x.comment.length > 0)

      setItems(mapped)
      setMeta({
        review_count: Number.isFinite(reviewCount) ? reviewCount : mapped.length,
        rating_value: ratingValue != null ? Number(ratingValue) : null,
      })
      setLoadState('ready')
    }

    void load()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const jsonLd = useMemo(() => {
    const count = meta.review_count || items.length
    const avg =
      meta.rating_value != null && !Number.isNaN(meta.rating_value)
        ? meta.rating_value
        : items.length > 0
          ? items.reduce((s, x) => s + x.rating, 0) / items.length
          : null
    const reviews = items.slice(0, 8).map((it) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: it.name },
      reviewRating: { '@type': 'Rating', ratingValue: it.rating, bestRating: 5, worstRating: 1 },
      reviewBody: it.comment,
    }))
    return {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: 'Amalgated Lending',
      description: 'Borrower testimonials and reviews published with consent.',
      aggregateRating:
        count > 0 && avg != null
          ? {
              '@type': 'AggregateRating',
              ratingValue: Number(avg.toFixed(2)),
              reviewCount: count,
              bestRating: 5,
              worstRating: 1,
            }
          : undefined,
      review: reviews.length ? reviews : undefined,
    }
  }, [items, meta.rating_value, meta.review_count])

  const showAggregate = meta.rating_value != null && !Number.isNaN(meta.rating_value) && items.length > 0

  return (
    <section
      className="border-t border-brand-secondary/20 bg-gradient-to-b from-brand-background via-white to-brand-background py-14 sm:py-20"
      aria-labelledby="customer-feedback-heading"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-72px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary">Customer Feedback</p>
          <h2
            id="customer-feedback-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-brand-text sm:text-[2rem] sm:leading-tight"
          >
            What our borrowers say
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-brand-text/70 sm:text-base">
            Real experiences from clients who trusted Amalgated Lending for personal, salary, and business financing.
          </p>
          {loadState === 'loading' ? (
            <p className="mt-4 text-sm text-brand-text/55" aria-live="polite">
              Loading published reviews…
            </p>
          ) : null}
          {loadState === 'error' ? (
            <p className="mt-4 text-sm text-amber-800/90" role="status">
              Reviews could not be loaded. Refresh the page or try again later.
            </p>
          ) : null}
          {showAggregate ? (
            <p className="mt-4 inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-black/[0.06] bg-white/80 px-4 py-2 text-sm text-brand-text/80 shadow-sm backdrop-blur-sm">
              <span className="font-semibold tabular-nums text-amber-500">★ {Number(meta.rating_value).toFixed(1)}</span>
              <span className="text-brand-text/50">·</span>
              <span>
                From <span className="font-semibold text-brand-text">{meta.review_count || items.length}</span> published
                reviews
              </span>
            </p>
          ) : null}
        </motion.div>

        {loadState === 'ready' && items.length === 0 ? (
          <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-dashed border-black/15 bg-white/60 px-6 py-10 text-center text-sm text-brand-text/70">
            <p className="font-medium text-brand-text">No published testimonials yet</p>
            <p className="mt-2 leading-relaxed">
              When the team approves feedback with borrower consent (and a clear name on the ticket), it appears here—
              usually within a few minutes. Featured items are listed first.
            </p>
          </div>
        ) : (
          <ul className="mx-auto mt-12 grid max-w-6xl list-none gap-5 sm:grid-cols-2 sm:gap-6 lg:mx-auto lg:mt-14 lg:grid-cols-3 lg:gap-6">
            {gridItems.map((item, index) => (
              <li key={item.id} className="min-w-0">
                <TestimonialCard item={item} index={index} reduceMotion={reduceMotion} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
