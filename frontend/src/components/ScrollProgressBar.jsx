import { motion, useScroll, useSpring, useReducedMotion } from 'framer-motion'

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const reduceMotion = useReducedMotion()
  const scaleX = useSpring(scrollYProgress, {
    stiffness: reduceMotion ? 1000 : 140,
    damping: reduceMotion ? 1000 : 26,
    restDelta: 0.001,
  })

  return (
    <motion.div
      aria-hidden
      className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-brand-primary"
      style={{ scaleX }}
    />
  )
}
