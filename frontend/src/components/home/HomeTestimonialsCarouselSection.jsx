import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { laravelRequest } from '../../utils/lendingLaravelApi.js'

const LIMIT = 12

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

export default function HomeTestimonialsCarouselSection() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState({ review_count: 0, rating_value: null })
  const [loadState, setLoadState] = useState('loading')
  const reduceMotion = useReducedMotion()
  const scrollerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadState('loading')
      const { res } = await laravelRequest(`/public/website/testimonials?limit=${LIMIT}`, {
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
      const mapped = rows
        .map((d) => ({
          id: `t-${d.id}`,
          name: String(d.display_name || 'Customer').trim() || 'Customer',
          roleLabel: String(d.customer_type_label || d.loan_type || 'Borrower').trim(),
          loanType: String(d.loan_type || d.customer_type_label || '').trim(),
          rating: Math.min(5, Math.max(1, Number(d.rating) || 5)),
          comment: String(d.message || '').trim(),
          verified: !!(d.verified_borrower || d.verified),
        }))
        .filter((x) => x.comment.length > 0)

      setItems(mapped)
      setMeta({
        review_count: Number(body?.meta?.review_count) || mapped.length,
        rating_value: body?.meta?.rating_value != null ? Number(body.meta.rating_value) : null,
      })
      setLoadState('ready')
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const scrollByDir = useCallback((dir) => {
    const el = scrollerRef.current
    if (!el) return
    const delta = Math.min(el.clientWidth * 0.85, 420) * dir
    el.scrollBy({ left: delta, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [reduceMotion])

  const jsonLd = useMemo(() => {
    const count = meta.review_count || items.length
    const avg =
      meta.rating_value != null && !Number.isNaN(meta.rating_value)
        ? meta.rating_value
        : items.length
          ? items.reduce((s, x) => s + x.rating, 0) / items.length
          : null
    const reviews = items.slice(0, 6).map((it) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: it.name },
      reviewRating: { '@type': 'Rating', ratingValue: it.rating, bestRating: 5, worstRating: 1 },
      reviewBody: it.comment,
    }))
    return {
      '@context': 'https://schema.org',
      '@type': 'FinancialService',
      name: 'Amalgated Lending Inc.',
      description: 'Borrower testimonials published with consent.',
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

  return (
    <section
      id="testimonials"
      className="scroll-mt-24 border-t border-red-100/40 bg-transparent py-24 lg:py-32"
      aria-labelledby="testimonials-heading"
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="app-container">
        <div className="mb-12 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Testimonials</p>
            <h2 id="testimonials-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-text sm:text-4xl">
              Loved by Filipino founders &amp; young professionals
            </h2>
            <p className="mt-4 text-base leading-relaxed text-brand-text/70">
              Swipe through verified borrower stories—synced from our Laravel testimonials API.
            </p>
            {loadState === 'loading' ? (
              <p className="mt-3 text-sm text-brand-text/55" aria-live="polite">
                Loading reviews…
              </p>
            ) : null}
            {loadState === 'error' ? (
              <p className="mt-3 text-sm text-amber-800/90" role="status">
                Reviews could not be loaded right now.
              </p>
            ) : null}
            {meta.rating_value != null && items.length ? (
              <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-black/[0.06] bg-[#F8F9FA] px-4 py-2 text-sm text-brand-text/80">
                <span className="font-semibold tabular-nums text-amber-500">★ {Number(meta.rating_value).toFixed(1)}</span>
                <span className="text-brand-text/40">·</span>
                <span>
                  <span className="font-semibold text-brand-text">{meta.review_count || items.length}</span> published reviews
                </span>
              </p>
            ) : null}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => scrollByDir(-1)}
              className="touch-target rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-brand-text shadow-sm transition hover:border-brand-primary/40 hover:text-brand-primary"
              aria-label="Previous testimonials"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollByDir(1)}
              className="touch-target rounded-full border border-black/10 bg-white px-5 text-sm font-semibold text-brand-text shadow-sm transition hover:border-brand-primary/40 hover:text-brand-primary"
              aria-label="Next testimonials"
            >
              →
            </button>
          </div>
        </div>

        {loadState === 'ready' && items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/15 bg-[#F8F9FA] px-8 py-14 text-center text-sm text-brand-text/70">
            Testimonials will appear here once the team publishes approved borrower feedback.
          </div>
        ) : (
          <div
            ref={scrollerRef}
            className="-mx-2 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pt-2 sm:gap-8"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {items.map((item, index) => (
              <motion.article
                key={item.id}
                initial={reduceMotion ? false : { opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-24px' }}
                transition={{ duration: 0.35, delay: reduceMotion ? 0 : Math.min(index, 6) * 0.04 }}
                className="w-[min(100%,22rem)] shrink-0 snap-center rounded-3xl border border-black/[0.07] bg-[#F8F9FA] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] sm:w-[24rem] lg:w-[26rem] lg:p-10"
              >
                <div className="flex items-start justify-between gap-3">
                  <Stars value={item.rating} />
                  {item.verified ? (
                    <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200/90">
                      Verified
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-brand-text/55 ring-1 ring-black/[0.06]">
                      {item.roleLabel || 'Borrower'}
                    </span>
                  )}
                </div>
                <p className="mt-6 text-[15px] leading-relaxed text-brand-text/90">&ldquo;{item.comment}&rdquo;</p>
                <div className="mt-8 border-t border-black/[0.06] pt-5">
                  <p className="text-sm font-semibold text-brand-text">{item.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-brand-text/55">{item.loanType || 'Amalgated borrower'}</p>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
