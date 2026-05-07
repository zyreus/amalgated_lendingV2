import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

export default function BackToTopButton() {
  const [visible, setVisible] = useState(false)
  const reduceMotion = useReducedMotion()

  /**
   * On long pages the scroll handler can fire ~60+ times/second on phones; that's
   * fine for math but `setVisible` triggers React work each time. We coalesce
   * with rAF so we only re-render when the threshold actually crosses.
   */
  useEffect(() => {
    let frame = 0
    let prev = false
    const update = () => {
      frame = 0
      const next = window.scrollY > 500
      if (next !== prev) {
        prev = next
        setVisible(next)
      }
    }
    const onScroll = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          aria-label="Back to top"
          onClick={scrollToTop}
          className="fixed bottom-5 left-5 z-40 rounded-full bg-brand-primary px-3.5 py-2.5 text-xs font-semibold text-white shadow-lg"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={reduceMotion ? {} : { opacity: 1, y: 0 }}
          exit={reduceMotion ? {} : { opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
        >
          Top
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}
