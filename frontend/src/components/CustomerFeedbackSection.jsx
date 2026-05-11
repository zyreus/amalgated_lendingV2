import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { laravelRequest } from '../utils/lendingLaravelApi.js'

const FALLBACK_ITEMS = [
  {
    id: 'fb-1',
    name: 'Maria L.',
    loanType: 'Salary Loan Client',
    rating: 5,
    comment:
      'Fast processing and very clear requirements. The team guided me from application to approval.',
    verified: true,
  },
  {
    id: 'fb-2',
    name: 'John C.',
    loanType: 'Business Loan Client',
    rating: 5,
    comment:
      'The loan officers explained the terms well and helped me choose the best option for my small business.',
    verified: true,
  },
  {
    id: 'fb-3',
    name: 'Anne P.',
    loanType: 'Personal Loan Client',
    rating: 4,
    comment:
      'Responsive support and smooth follow-up. I appreciated how transparent the process was.',
    verified: false,
  },
]

function Stars({ value }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star, idx) => (
        <motion.span
          key={star}
          className={star <= value ? 'text-amber-400' : 'text-gray-300'}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: reduceMotion ? 0 : idx * 0.04 }}
        >
          ★
        </motion.span>
      ))}
    </div>
  )
}

export default function CustomerFeedbackSection() {
  const [items, setItems] = useState(FALLBACK_ITEMS)
  const [meta, setMeta] = useState({ review_count: FALLBACK_ITEMS.length, rating_value: 4.67 })
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { res } = await laravelRequest('/public/website/testimonials?limit=12', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (cancelled || !res?.ok) return
      const body = await res.json().catch(() => ({}))
      const rows = Array.isArray(body?.data) ? body.data : []
      const reviewCount = Number(body?.meta?.review_count)
      const ratingValue = body?.meta?.rating_value
      if (rows.length === 0) return
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
      if (mapped.length === 0) return
      setItems(mapped)
      setMeta({
        review_count: Number.isFinite(reviewCount) ? reviewCount : mapped.length,
        rating_value: ratingValue != null ? Number(ratingValue) : null,
      })
      setIndex(0)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) return undefined
    if (items.length <= 1) return undefined
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [reduceMotion, items.length])

  const active = items[index] || items[0]

  const jsonLd = useMemo(() => {
    const count = meta.review_count || items.length
    const avg =
      meta.rating_value != null && !Number.isNaN(meta.rating_value)
        ? meta.rating_value
        : items.reduce((s, x) => s + x.rating, 0) / Math.max(items.length, 1)
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
        count > 0
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

  return (
    <section className="border-t border-brand-secondary/25 bg-brand-background py-16" aria-labelledby="customer-feedback-heading">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Customer Feedback</p>
          <h2 id="customer-feedback-heading" className="mt-3 text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
            What our borrowers say
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-text/70 sm:text-base">
            Real experiences from clients who trusted Amalgated Lending for personal, salary, and business financing.
          </p>
        </motion.div>

        <div className="mx-auto mt-8 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.article
              key={active.id}
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={reduceMotion ? {} : { opacity: 1, x: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, x: -18 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_8px_22px_rgba(0,0,0,0.06)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Stars value={active.rating} />
                {active.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                    <span aria-hidden>✓</span> Verified borrower
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-brand-text/85">{active.comment}</p>
              <div className="mt-4 border-t border-black/10 pt-3">
                <p className="text-sm font-semibold text-brand-text">{active.name}</p>
                <p className="text-xs text-brand-text/60">{active.loanType}</p>
              </div>
            </motion.article>
          </AnimatePresence>
          <div className="mt-4 flex justify-center gap-2">
            {items.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-brand-primary' : 'w-2.5 bg-black/20 hover:bg-black/30'}`}
                aria-label={`Show testimonial ${dotIndex + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
