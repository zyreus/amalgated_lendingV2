import { motion, useReducedMotion } from 'framer-motion'
import { FadeInView } from '../animations/MotionPrimitives.jsx'

export default function AboutUsSection() {
  const reduceMotion = useReducedMotion()
  return (
    <section id="about-us" className="app-container landing-section">
      <motion.div
        className="landing-card-grid lg:grid-cols-2"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.45 }}
      >
        <FadeInView className="landing-panel h-full">
          <p className="section-title">About Us</p>
          <h2 className="landing-section-heading">
            A Davao-based lender focused on responsible growth.
          </h2>
          <p className="landing-section-lead max-w-prose text-brand-text/75">
            Amalgated Lending Inc. supports individuals, employees, and small business owners with practical financing
            options. Since 2015, our team has worked to make loan access more transparent, secure, and supportive
            for communities across Davao City, Davao del Sur, and nearby Mindanao areas.
          </p>
          <div className="landing-content-after-header landing-card-grid sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-text/60">Mission</p>
              <p className="mt-1 text-sm text-brand-text/80">Provide fair and understandable financing solutions.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-text/60">Vision</p>
              <p className="mt-1 text-sm text-brand-text/80">Be the most trusted local lending partner in Mindanao.</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand-text/60">Experience</p>
              <p className="mt-1 text-sm text-brand-text/80">10+ years in lending and customer support operations.</p>
            </div>
          </div>
        </FadeInView>
        <motion.aside
          className="landing-panel h-full"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45, delay: reduceMotion ? 0 : 0.06 }}
        >
          <h3 className="text-lg font-semibold text-brand-text sm:text-xl">Responsible Lending Commitment</h3>
          <ul className="landing-stack mt-6 text-sm leading-relaxed text-brand-text/75">
            <li>• We assess ability-to-pay before approval recommendations.</li>
            <li>• We explain rates, fees, and repayment terms before signing.</li>
            <li>• We avoid misleading “too good to be true” claims.</li>
            <li>• We maintain respectful and responsive borrower support.</li>
            <li>• We prioritize long-term client stability over risky lending.</li>
          </ul>
          <p className="mt-4 rounded-xl bg-black/5 px-3 py-2 text-xs text-brand-text/70">
            Note: Final approval and terms remain subject to document verification and internal credit review.
          </p>
        </motion.aside>
      </motion.div>
    </section>
  )
}
