import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { fetchWebsiteTestimonials } from '../../utils/fetchWebsiteTestimonials.js'
import StarRating from '../StarRating.jsx'
import { computeAverageRating } from '../../utils/feedbackRating.js'
import heroWhyChooseUsImage from '../../assets/hero-why-choose-us.png'

/**
 * Marketing hero — official crimson / orange / gold / cream brand system (`index.css` @theme).
 * Backend integration: primary apply flow stays on existing borrower portal route.
 */
const HERO_IMAGE_SRC = heroWhyChooseUsImage
const HERO_IMAGE_ALT =
  'Amalgated Lending — Why choose us: we prioritize transparency, guide you step by step, and process quickly.'

export default function HomeModernHero() {
  const reduceMotion = useReducedMotion()
  const [stats, setStats] = useState({ loadState: 'loading', reviewCount: 0, ratingValue: null })

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = await fetchWebsiteTestimonials(1)
      if (cancelled) return
      if (!result.ok) {
        setStats({ loadState: 'error', reviewCount: 0, ratingValue: null })
        return
      }
      setStats({
        loadState: 'ready',
        reviewCount: result.meta.review_count,
        ratingValue: result.meta.rating_value,
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const ratingLine = useMemo(() => {
    if (stats.loadState === 'loading') {
      return { score: null, busy: true }
    }
    if (stats.reviewCount > 0 && stats.ratingValue != null && !Number.isNaN(stats.ratingValue)) {
      return { score: stats.ratingValue, busy: false }
    }
    return { score: null, busy: false }
  }, [stats])

  const ratingCaption = useMemo(() => {
    if (stats.loadState === 'loading') return 'Loading published feedback…'
    if (stats.loadState === 'error') return 'Could not load feedback summary.'
    if (stats.reviewCount <= 0) return 'Published client ratings appear after admin approval.'
    const n = stats.reviewCount.toLocaleString()
    return `From ${n} published ${stats.reviewCount === 1 ? 'review' : 'reviews'}`
  }, [stats])

  const sectionVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 24 },
      visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.55,
          delay: reduceMotion ? 0 : 0.06 * i,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    }),
    [reduceMotion],
  )

  return (
    <motion.section
      id="hero"
      aria-labelledby="hero-heading"
      className="relative scroll-mt-28 bg-transparent text-brand-text landing-hero-section"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.07 } },
      }}
    >
      {/* Soft mesh — cream canvas with crimson + orange wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_100%_-5%,rgba(217,34,67,0.09),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_65%_45%_at_0%_100%,rgba(246,157,57,0.08),transparent_50%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-brand-primary/40 via-brand-primary/15 to-transparent"
      />

      <div className="app-container relative">
        <motion.div
          className="grid items-center gap-10 sm:gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-16"
        >
          <div className="min-w-0 max-w-2xl lg:max-w-none">
            <motion.p
              variants={sectionVariants}
              custom={0}
              className="font-accent text-xs font-semibold uppercase tracking-[0.22em] text-brand-primary"
            >
              Amalgated Lending Inc. · Davao &amp; Mindanao
            </motion.p>

            <motion.h1
              id="hero-heading"
              variants={sectionVariants}
              custom={1}
              className="heading-display mt-4 break-words text-[2.35rem] font-semibold leading-[1.12] tracking-tight text-balance text-slate-900 sm:mt-5 sm:text-5xl lg:text-[3.25rem] xl:text-6xl"
            >
              Personal Loans &amp; Lending Solutions,{' '}
              <span className="bg-gradient-to-r from-brand-primary via-brand-accent to-brand-premium bg-clip-text text-transparent">
                All in One Place.
              </span>
            </motion.h1>

            <motion.p
              variants={sectionVariants}
              custom={2}
              className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 sm:mt-6 sm:text-xl sm:leading-relaxed"
            >
              Fast, secure, and transparent lending for Filipinos. Real Estate, Chattel, Pension, Business &amp; More.
            </motion.p>

            <motion.p
              variants={sectionVariants}
              custom={2.5}
              lang="tl"
              className="mt-3 max-w-xl text-sm leading-relaxed text-slate-500"
            >
              Mabilis at tapat na serbisyo—mula aplikasyon hanggang aprubahan, kasama ka namin sa bawat hakbang.
            </motion.p>

            <motion.div
              variants={sectionVariants}
              custom={3}
              className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
            >
              {/*
                INTEGRATION: Borrower apply / registration — same SPA entry as legacy hero.
                Alternate entry points: `/apply`, `/borrower/register` if product pages deep-link there.
              */}
              <Link
                to="/borrower/login"
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-primary px-6 py-4 text-sm font-semibold text-white shadow-brand-primary transition hover:bg-brand-primary-hover hover:shadow-[0_14px_40px_rgba(217,34,67,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary active:scale-[0.99] sm:w-auto sm:px-8"
              >
                Apply Now
                <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              {/*
                INTEGRATION: On-page calculator — `#calculator` wraps `HomeLoanCalculator` in App.jsx.
              */}
              <a
                href="#calculator"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border-2 border-brand-primary bg-white px-6 py-4 text-sm font-semibold text-brand-primary shadow-sm transition hover:bg-brand-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary sm:w-auto sm:px-8"
              >
                Calculate Your Loan
              </a>
            </motion.div>

            <motion.dl
              variants={sectionVariants}
              custom={4}
              className="mt-10 grid max-w-xl grid-cols-1 gap-6 border-t border-slate-200/90 pt-8 text-sm sm:grid-cols-3 sm:gap-8 sm:pt-10"
            >
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Client rating</dt>
                <dd
                  className="mt-2 flex items-baseline gap-1.5 text-slate-900"
                  aria-live="polite"
                  aria-busy={ratingLine.busy}
                  aria-label={
                    ratingLine.score != null
                      ? `${ratingLine.score.toFixed(1)} out of 5 average from ${stats.reviewCount.toLocaleString()} published reviews`
                      : stats.loadState === 'loading'
                        ? 'Loading client rating'
                        : 'No published average rating yet'
                  }
                >
                  <span className="text-2xl font-semibold tabular-nums text-brand-primary sm:text-3xl">
                    {ratingLine.score != null ? ratingLine.score.toFixed(1) : stats.loadState === 'loading' ? '…' : '—'}
                  </span>
                  <span className="sr-only">out of 5 stars</span>
                  {ratingLine.score != null ? (
                    <StarRating
                      value={ratingLine.score}
                      size="sm"
                      filledClass="text-brand-premium"
                      emptyClass="text-slate-200"
                    />
                  ) : null}
                </dd>
                <p className="mt-1 text-xs text-slate-500">{ratingCaption}</p>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Serving since</dt>
                <dd className="mt-2 text-2xl font-semibold tabular-nums text-brand-primary sm:text-3xl">2015</dd>
                <p className="mt-1 text-xs text-slate-500">Trusted local lending partner</p>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Coverage</dt>
                <dd className="mt-2 text-lg font-semibold leading-snug text-brand-primary sm:text-xl">Davao &amp; Mindanao</dd>
                <p className="mt-1 text-xs text-slate-500">Walk-in + digital application</p>
              </div>
            </motion.dl>
          </div>

          <motion.div variants={sectionVariants} custom={0.5} className="relative mx-auto w-full min-w-0 max-w-lg lg:mx-0 lg:max-w-none">
            <div
              aria-hidden
              className="absolute -right-6 -top-8 h-48 w-48 rounded-full bg-brand-primary/15 blur-3xl sm:h-64 sm:w-64 lg:-right-10"
            />
            <div
              aria-hidden
              className="absolute -bottom-10 -left-4 h-40 w-40 rounded-full bg-brand-primary/10 blur-3xl sm:h-52 sm:w-52"
            />

            <div className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_70px_rgba(217,34,67,0.1)] ring-1 ring-slate-200/70 sm:rounded-[2rem]">
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-slate-800 shadow-md backdrop-blur-sm ring-1 ring-slate-200/80 sm:right-5 sm:top-5 sm:text-xs">
                <span className="h-2 w-2 rounded-full bg-brand-primary" aria-hidden />
                Secure online apply
              </div>

              <img
                src={HERO_IMAGE_SRC}
                alt={HERO_IMAGE_ALT}
                width={509}
                height={655}
                fetchPriority="high"
                decoding="async"
                className="block w-full h-auto"
              />

              <div className="border-t border-slate-200/90 bg-gradient-to-br from-white to-brand-cream/80 p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">Why borrowers choose us</p>
                <ul className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-600 sm:grid-cols-2 sm:gap-5">
                  <li className="flex gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-premium/35 text-brand-primary" aria-hidden>
                      ✓
                    </span>
                    Transparent rates &amp; amortization before you sign
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-premium/35 text-brand-primary" aria-hidden>
                      ✓
                    </span>
                    Real people in Davao—plus a secure borrower portal
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  )
}
