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
    <section id="loan-process" className="app-container py-8 sm:py-12">
      <FadeInView>
        <p className="section-title">How It Works</p>
        <h2 className="mt-2 text-3xl font-semibold text-brand-text">Simple step-by-step loan process</h2>
      </FadeInView>
      <div className="relative mt-6">
        <motion.div
          aria-hidden
          className="absolute left-4 right-4 top-6 hidden h-0.5 bg-brand-primary/20 xl:block"
          initial={reduceMotion ? false : { scaleX: 0 }}
          whileInView={reduceMotion ? {} : { scaleX: 1 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{ transformOrigin: 'left' }}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {steps.map(([title, desc], index) => (
            <motion.article
              key={title}
              className="surface-card-light p-5"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.45, delay: reduceMotion ? 0 : index * 0.08 }}
            >
              <motion.div
                className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-semibold text-brand-primary"
                initial={reduceMotion ? false : { scale: 0.9, opacity: 0.6 }}
                whileInView={reduceMotion ? {} : { scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, delay: reduceMotion ? 0 : index * 0.08 + 0.1 }}
              >
                {index + 1}
              </motion.div>
              <h3 className="font-semibold text-brand-text">{title}</h3>
              <p className="mt-2 text-sm text-brand-text/70">{desc}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  )
}
