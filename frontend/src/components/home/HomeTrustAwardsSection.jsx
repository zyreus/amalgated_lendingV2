import { motion, useReducedMotion } from 'framer-motion'

const BADGES = [
  { title: 'SEC oversight', desc: 'Corporate disclosures & lending governance aligned with Philippine regulators.' },
  { title: 'Data Privacy Act', desc: 'Purpose-limited collection with borrower consent trails in the CRM.' },
  { title: 'PCI-aware payments', desc: 'Receipt uploads + reference tracking with tamper-evident logs.' },
  { title: 'ISO-style controls', desc: 'Role-based admin access, audit trails, and segregated duties for approvals.' },
]

export default function HomeTrustAwardsSection() {
  const reduceMotion = useReducedMotion()

  return (
    <section className="bg-[#0a0a0a] py-20 text-white lg:py-28" aria-labelledby="trust-awards-heading">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-20 xl:px-28">
        <div className="mb-12 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-300/90">Awards &amp; recognition</p>
          <h2 id="trust-awards-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Trust engineered—not marketed
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/70">
            Compliance is continuous: monitoring, delinquency workflows, and collector performance analytics feed the same CRM
            your support agent sees.
          </p>
        </div>

        <ul className="grid list-none gap-8 sm:grid-cols-2 lg:gap-12">
          {BADGES.map((b, i) => (
            <motion.li
              key={b.title}
              initial={reduceMotion ? false : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-32px' }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : i * 0.06 }}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md lg:p-10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D90429]/90 text-sm font-bold text-white">
                ✓
              </div>
              <h3 className="mt-6 text-lg font-semibold">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/65">{b.desc}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  )
}
