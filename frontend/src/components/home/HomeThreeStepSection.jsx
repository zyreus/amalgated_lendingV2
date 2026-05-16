import { motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'

const STEPS = [
  {
    step: '01',
    title: 'Apply',
    body: 'Pick your product, upload requirements, and e-sign disclosures from any device.',
    href: '/borrower/register',
    cta: 'Start application',
  },
  {
    step: '02',
    title: 'Verify',
    body: 'Our credit & ops stack validates income, collateral (if any), and AML basics in one flow.',
    href: '/application-flow',
    cta: 'See verification guide',
  },
  {
    step: '03',
    title: 'Get approved',
    body: 'Digital release instructions + borrower dashboard for schedules, extensions, and re-apply.',
    href: '/borrower/login',
    cta: 'Open dashboard',
  },
]

export default function HomeThreeStepSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section
      id="application-process"
      className="scroll-mt-28 border-y border-black/[0.06] bg-gradient-to-b from-white via-brand-background-alt to-white section-y"
      aria-labelledby="process-heading"
    >
      <div className="app-container">
        <div className="mb-10 text-center sm:mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Application process</p>
          <h2 id="process-heading" className="mt-3 text-3xl font-semibold tracking-tight text-brand-text sm:text-4xl">
            Three calm steps. One confident outcome.
          </h2>
        </div>

        <ol className="grid list-none gap-8 lg:grid-cols-3 lg:gap-10">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.step}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : i * 0.08 }}
              className="surface-card-light-tight relative p-8 shadow-[0_12px_40px_rgba(0,0,0,0.06)] lg:p-10"
            >
              <span className="text-5xl font-bold tabular-nums text-brand-primary/15">{s.step}</span>
              <h3 className="mt-4 text-xl font-semibold text-brand-text">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-brand-text/70">{s.body}</p>
              <Link
                to={s.href}
                className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-brand-primary transition hover:text-brand-primary-hover"
              >
                {s.cta}
                <span className="ml-2 inline-block h-px w-8 bg-brand-primary/50 align-middle" aria-hidden />
              </Link>
              {i < STEPS.length - 1 ? (
                <div
                  className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-r from-brand-primary/40 to-transparent lg:block xl:-right-6 xl:w-10"
                  aria-hidden
                />
              ) : null}
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  )
}
