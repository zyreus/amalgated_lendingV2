import { motion, useReducedMotion } from 'framer-motion'
import { FadeInView } from '../animations/MotionPrimitives.jsx'

const items = [
  'Fast approval within 24-48 hours for qualified applications',
  'Minimal and clearly listed requirements',
  'Competitive and transparent interest rates',
  'Flexible payment terms based on product type',
  'No hidden charges policy',
  'Friendly and responsive customer support',
  'Licensed and legitimate lending operation',
  'Serving Davao City, Davao del Sur, and nearby areas',
]

export default function AdvantagesSection() {
  const reduceMotion = useReducedMotion()
  return (
    <section id="why-choose-us" className="app-container py-8 sm:py-12">
      <FadeInView className="surface-card-light p-6 sm:p-7">
        <p className="section-title">Why Choose Us</p>
        <h2 className="mt-2 text-3xl font-semibold text-brand-text">Built for speed, clarity, and borrower confidence.</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <motion.article
              key={item}
              className="rounded-xl border border-black/10 bg-white p-4 text-sm text-brand-text/80 shadow-sm"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.05 }}
              whileHover={reduceMotion ? {} : { y: -4, scale: 1.01, boxShadow: '0 16px 30px rgba(0,0,0,0.08)' }}
            >
              <motion.p
                className="font-medium"
                whileHover={reduceMotion ? {} : { x: 1 }}
                transition={{ duration: 0.2 }}
              >
                {item}
              </motion.p>
            </motion.article>
          ))}
        </div>
      </FadeInView>
    </section>
  )
}
