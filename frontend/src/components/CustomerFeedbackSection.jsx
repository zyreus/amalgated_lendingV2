import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const FEEDBACK_ITEMS = [
  {
    id: 'fb-1',
    name: 'Maria L.',
    role: 'Salary Loan Client',
    rating: 5,
    comment:
      'Fast processing and very clear requirements. The team guided me from application to approval.',
  },
  {
    id: 'fb-2',
    name: 'John C.',
    role: 'Business Loan Client',
    rating: 5,
    comment:
      'The loan officers explained the terms well and helped me choose the best option for my small business.',
  },
  {
    id: 'fb-3',
    name: 'Anne P.',
    role: 'Personal Loan Client',
    rating: 4,
    comment:
      'Responsive support and smooth follow-up. I appreciated how transparent the process was.',
  },
]

function Stars({ value }) {
  const reduceMotion = useReducedMotion()
  return (
    <div className="flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star, idx) => (
        <motion.span
          key={star}
          className={star <= value ? 'text-amber-400' : 'text-gray-300'}
          initial={reduceMotion ? false : { opacity: 0, scale: 0.85 }}
          animate={reduceMotion ? {} : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.2, delay: reduceMotion ? 0 : idx * 0.04 }}
        >
          ★
        </motion.span>
      ))}
    </div>
  )
}

export default function CustomerFeedbackSection() {
  const [index, setIndex] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (reduceMotion) return undefined
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % FEEDBACK_ITEMS.length)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [reduceMotion])

  const active = FEEDBACK_ITEMS[index]

  return (
    <section id="customer-feedback" className="border-t border-brand-secondary/25 bg-brand-background py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Customer Feedback</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-brand-text sm:text-3xl">
            What our borrowers say
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-brand-text/70 sm:text-base">
            Real experiences from clients who trusted Amalgated Lending for personal, salary, and business financing.
          </p>
        </motion.div>

        <div className="mt-8 mx-auto max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.article
              key={active.id}
              initial={reduceMotion ? false : { opacity: 0, x: 18 }}
              animate={reduceMotion ? {} : { opacity: 1, x: 0 }}
              exit={reduceMotion ? {} : { opacity: 0, x: -18 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-black/10 bg-white p-5 shadow-[0_8px_22px_rgba(0,0,0,0.06)]"
            >
              <Stars value={active.rating} />
              <p className="mt-3 text-sm leading-relaxed text-brand-text/85">{active.comment}</p>
              <div className="mt-4 border-t border-black/10 pt-3">
                <p className="text-sm font-semibold text-brand-text">{active.name}</p>
                <p className="text-xs text-brand-text/60">{active.role}</p>
              </div>
            </motion.article>
          </AnimatePresence>
          <div className="mt-4 flex justify-center gap-2">
            {FEEDBACK_ITEMS.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                className={`h-2.5 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-brand-primary' : 'w-2.5 bg-black/20 hover:bg-black/30'}`}
                aria-label={`Show testimonial ${dotIndex + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

