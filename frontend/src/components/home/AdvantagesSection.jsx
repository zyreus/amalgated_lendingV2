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
    <section id="why-choose-us" className="app-container landing-section">
      <FadeInView className="landing-panel">
        <div className="landing-section-header">
          <p className="section-title">Why Choose Us</p>
          <h2 className="landing-section-heading">
            Built for speed, clarity, and borrower confidence.
          </h2>
        </div>
        <div className="landing-content-after-header landing-card-grid sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <motion.article
              key={item}
              className="landing-inner-card"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : index * 0.05 }}
              whileHover={reduceMotion ? {} : { y: -4, scale: 1.01, boxShadow: '0 16px 30px rgba(0,0,0,0.08)' }}
            >
              <p className="text-sm font-medium leading-relaxed text-brand-text/85">{item}</p>
            </motion.article>
          ))}
        </div>
      </FadeInView>
    </section>
  )
}
