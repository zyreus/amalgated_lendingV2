import { motion, useReducedMotion } from 'framer-motion'

const FEATURES = [
  {
    title: 'Fast approval',
    body: 'Parallel review queues and CRM-backed tasking keep your file moving—not stuck in a black box.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Secure processing',
    body: 'TLS everywhere, hardened uploads, and borrower-only document scopes aligned with Philippine privacy norms.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.75}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    ),
  },
  {
    title: 'Flexible payments',
    body: 'Schedules, SOA exports, and reminders tuned for GCash, bank, and branch workflows.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'AI-powered support',
    body: 'Instant answers on products and requirements—seamlessly handed off to human staff inside the CRM thread.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    title: 'CRM-backed service',
    body: 'Every touchpoint is auditable—ideal for repeat borrowers, SMEs, and compliance-ready operations.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Credit insights',
    body: 'Portfolio-aware prompts help you understand utilization, next best action, and healthy repayment habits.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export default function HomeFintechFeaturesSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section
      className="relative overflow-hidden bg-transparent py-20 lg:py-28"
      aria-labelledby="features-heading"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_100%_0%,rgba(230,57,70,0.06),transparent_55%)]"
      />
      <div className="app-container relative">
        <div className="mb-10 max-w-3xl sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Why Amalgated</p>
          <h2 id="features-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-text sm:text-4xl">
            Enterprise-grade rails, consumer-grade experience
          </h2>
          <p className="mt-4 text-base leading-relaxed text-brand-text/70">
            The same controls our internal teams rely on—surfaced as simple, confident interactions for you.
          </p>
        </div>

        <ul className="grid list-none gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10">
          {FEATURES.map((f, i) => (
            <motion.li
              key={f.title}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-48px' }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : i * 0.05 }}
              className="rounded-3xl border border-red-100/40 bg-white p-8 shadow-[0_8px_30px_rgba(230,57,70,0.06)] lg:p-10 transition hover:border-brand-primary/30 hover:shadow-[0_16px_48px_rgba(217,4,41,0.1)]"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary ring-1 ring-brand-primary/15">
                {f.icon}
              </div>
              <h3 className="mt-6 text-lg font-semibold text-brand-text">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-text/70">{f.body}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
