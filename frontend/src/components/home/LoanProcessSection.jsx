import { motion, useReducedMotion } from 'framer-motion'
import { FadeInView } from '../animations/MotionPrimitives.jsx'

const steps = [
  ['1. Submit Application', 'Complete the online form and provide your basic details.'],
  ['2. Document Review & Verification', 'We validate IDs and required documents.'],
  ['3. Loan Approval', 'Qualified applications proceed to approval.'],
  ['4. Disbursement', 'Funds can be released via GCash, bank transfer, or approved method.'],
  ['5. Repayment', 'Pay based on agreed schedule with clear due dates.'],
]

export default function LoanProcessSection() {
  const reduceMotion = useReducedMotion()
  return (
    <section id="loan-process" className="app-container landing-section">
      <FadeInView className="landing-section-header">
        <p className="section-title">How It Works</p>
        <h2 className="landing-section-heading">
          Simple step-by-step loan process
        </h2>
      </FadeInView>
      <div className="relative landing-content-after-header">
        <motion.div
          aria-hidden
          className="absolute left-4 right-4 top-6 hidden h-0.5 bg-brand-primary/20 xl:block"
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={reduceMotion ? {} : { scaleX: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ transformOrigin: 'left' }}
        />
        <div className="landing-card-grid md:grid-cols-2 xl:grid-cols-5">
          {steps.map(([title, desc], index) => (
            <motion.article
              key={title}
              className="landing-panel h-full"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : index * 0.08 }}
            >
              <div className="mb-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-semibold text-brand-primary">
                {index + 1}
              </div>
              <h3 className="font-semibold text-brand-text">{title}</h3>
              <p className="mt-4 text-sm leading-relaxed text-brand-text/70">{desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
