import { motion, useReducedMotion } from 'framer-motion'

export function useMotionTiming() {
  const reduceMotion = useReducedMotion()
  return {
    reduceMotion,
    duration: reduceMotion ? 0 : 0.55,
    delayStep: reduceMotion ? 0 : 0.08,
    ease: [0.22, 1, 0.36, 1],
  }
}

export function FadeInView({ children, className = '', y = 20, delay = 0 }) {
  const { reduceMotion, duration, ease } = useMotionTiming()
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y }}
      whileInView={reduceMotion ? {} : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerInView({ children, className = '' }) {
  const { reduceMotion, duration, delayStep, ease } = useMotionTiming()
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : 'hidden'}
      whileInView={reduceMotion ? {} : 'show'}
      viewport={{ once: true, margin: '-80px' }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: delayStep } },
      }}
    >
      {Array.isArray(children)
        ? children.map((child, idx) => (
            <motion.div
              key={idx}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: { duration, ease } },
              }}
            >
              {child}
            </motion.div>
          ))
        : children}
    </motion.div>
  )
}

export function HoverLiftCard({ children, className = '' }) {
  const { reduceMotion } = useMotionTiming()
  return (
    <motion.div
      className={className}
      whileHover={reduceMotion ? {} : { y: -4, scale: 1.01 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
