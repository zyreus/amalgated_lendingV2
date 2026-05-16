import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

const TRUST_BADGES = [
  { label: 'SEC registered', sub: 'Governed lending standards' },
  { label: 'TLS + portal', sub: 'Encrypted borrower journeys' },
  { label: 'CRM + AI chat', sub: 'Human handoff when it matters' },
  { label: 'Transparent fees', sub: 'Schedule before you sign' },
]

const PARTNER_STRIP = ['Davao HQ', 'Mindanao network', 'Digital-first', 'Same-day decisions*']

const FLOAT_METRICS = [
  { label: 'Live catalog', value: 'API-driven', sub: 'Programs sync with admin' },
  { label: 'Conversion stack', value: 'Hero → Apply', sub: 'Prefilled eligibility params' },
  { label: 'Trust layer', value: '256-bit TLS', sub: 'Aligned with borrower portal' },
]

export default function HomePremiumHero() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [employment, setEmployment] = useState('employed')
  const [amount, setAmount] = useState('50000')

  const sectionVariants = useMemo(
    () => ({
      hidden: reduceMotion ? {} : { opacity: 0, y: 28 },
      visible: (i) => ({
        opacity: 1,
        y: 0,
        transition: {
          duration: reduceMotion ? 0 : 0.65,
          delay: reduceMotion ? 0 : 0.08 * i,
          ease: [0.22, 1, 0.36, 1],
        },
      }),
    }),
    [reduceMotion],
  )

  const onFindRate = (e) => {
    e.preventDefault()
    const q = new URLSearchParams({
      employment,
      amount: String(amount).replace(/\D/g, '') || '0',
      source: 'hero_find_rate',
    })
    navigate(`/application-flow?${q.toString()}`)
  }

  return (
    <motion.section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#082f49] pt-28 pb-24 text-white sm:pt-32 sm:pb-28 lg:pt-36 lg:pb-32"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } },
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_80%_-5%,rgba(34,211,238,0.35),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_10%_90%,rgba(56,189,248,0.2),transparent_50%)]"
      />
      <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-300/30 to-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      <div className="relative mx-auto min-w-0 max-w-7xl px-6 lg:px-16 xl:px-24">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
          <div className="space-y-0">
            <motion.p
              variants={sectionVariants}
              custom={0}
              className="font-accent text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/90"
            >
              Philippines · Enterprise-grade lending UX
            </motion.p>
            <motion.h1
              variants={sectionVariants}
              custom={1}
              className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.35rem] xl:text-6xl"
            >
              Borrow smarter with a{' '}
              <span className="bg-gradient-to-r from-cyan-300 to-sky-400 bg-clip-text text-transparent">premium fintech</span>{' '}
              experience.
            </motion.h1>
            <motion.p
              variants={sectionVariants}
              custom={2}
              className="mt-5 max-w-xl text-lg leading-relaxed text-slate-200/95 sm:text-xl"
            >
              Clear terms, responsive service, and a borrower portal that keeps every peso traceable—built on your existing Laravel APIs,
              CRM, and chat stack.
            </motion.p>
            <motion.p variants={sectionVariants} custom={3} className="mt-3 text-sm font-medium text-cyan-100/90 sm:text-base">
              Amalgated Lending Inc.
            </motion.p>

            <motion.ul
              variants={sectionVariants}
              custom={4}
              className="mt-10 flex flex-wrap gap-3"
              aria-label="Trust signals"
            >
              {TRUST_BADGES.map((b) => (
                <li
                  key={b.label}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-xs backdrop-blur-md sm:text-[13px]"
                >
                  <span className="font-semibold text-white">{b.label}</span>
                  <span className="mt-0.5 block text-[11px] text-slate-300/90">{b.sub}</span>
                </li>
              ))}
            </motion.ul>

            <motion.div variants={sectionVariants} custom={5} className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/borrower/register"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 px-8 py-4 text-sm font-semibold text-slate-950 shadow-[0_10px_40px_rgba(34,211,238,0.35)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
              >
                Apply now
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#calculator"
                className="inline-flex min-h-11 items-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-cyan-300/50 hover:bg-white/10"
              >
                Explore calculators
              </a>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              custom={6}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400"
              aria-label="Coverage and operations"
            >
              {PARTNER_STRIP.map((label) => (
                <span key={label} className="text-slate-300">
                  {label}
                </span>
              ))}
            </motion.div>
            <p className="mt-2 text-[11px] text-slate-500">*Same-day decisions when requirements are complete and subject to credit review.</p>
          </div>

          <motion.div variants={sectionVariants} custom={0.5} className="relative">
            {!reduceMotion &&
              FLOAT_METRICS.map((m, i) => (
                <motion.div
                  key={m.label}
                  aria-hidden
                  className={`absolute z-10 hidden rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-3 text-xs shadow-lg backdrop-blur-xl md:block ${
                    i === 0 ? '-right-4 -top-6 max-w-[11rem]' : i === 1 ? '-left-6 top-1/4 max-w-[10rem]' : 'bottom-8 -right-2 max-w-[11rem]'
                  }`}
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-200/90">{m.label}</p>
                  <p className="mt-1 text-base font-bold text-white">{m.value}</p>
                  <p className="mt-0.5 text-[10px] text-slate-300/85">{m.sub}</p>
                </motion.div>
              ))}

            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.08] p-8 shadow-[0_28px_90px_rgba(2,6,23,0.55)] backdrop-blur-xl lg:p-10">
              <div className="absolute inset-x-[-30%] -top-24 h-52 rounded-full bg-cyan-500/25 blur-3xl" aria-hidden />

              <div className="relative space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300/80">Find my rate</p>
                    <p className="mt-1 text-lg font-semibold text-white">Route to the right product</p>
                  </div>
                  <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-semibold text-cyan-100 ring-1 ring-cyan-400/35">
                    No hard sell
                  </span>
                </div>

                <form
                  onSubmit={onFindRate}
                  className="rounded-2xl border border-white/10 bg-slate-950/40 p-6 lg:p-8"
                  aria-label="Find my rate"
                >
                  <p className="text-sm font-semibold text-white">Loan amount (₱)</p>
                  <p className="mt-1 text-xs text-slate-400">We pass this into your application flow—no duplicate data entry.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-300">
                      Employment
                      <select
                        value={employment}
                        onChange={(e) => setEmployment(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/40"
                      >
                        <option value="employed" className="text-gray-900">
                          Employed
                        </option>
                        <option value="self" className="text-gray-900">
                          Self-employed / SME
                        </option>
                        <option value="ofw" className="text-gray-900">
                          OFW / contract
                        </option>
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-300">
                      Target amount
                      <input
                        type="text"
                        inputMode="numeric"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/40"
                        placeholder="50000"
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_8px_28px_rgba(34,211,238,0.35)] transition hover:brightness-105"
                  >
                    Find my rate
                  </button>
                </form>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] text-slate-400">Operations</p>
                    <p className="mt-1 text-lg font-semibold text-white">Filament-ready admin</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-400">Same backend your team already uses for applications and CRM.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="text-[11px] text-slate-400">Experience</p>
                    <p className="mt-1 text-lg font-semibold text-cyan-200">4.8 / 5</p>
                    <p className="mt-1 text-[11px] text-slate-400">Borrower-first UI with motion-safe fallbacks.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}
