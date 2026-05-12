import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

const SPLASH_TOTAL_MS = 3000
const SPLASH_FADE_MS = 700

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Keep the splash visible longer so the logo animation is noticeable.
    const startFade = setTimeout(() => setFading(true), SPLASH_TOTAL_MS - SPLASH_FADE_MS)
    const unmount = setTimeout(() => onDone(), SPLASH_TOTAL_MS)
    return () => {
      clearTimeout(startFade)
      clearTimeout(unmount)
    }
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ opacity: { duration: fading ? 0.5 : 0.4, ease: 'easeOut' } }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-6">
        <motion.div
          className="flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#dc2626] bg-white p-3 sm:h-32 sm:w-32 sm:p-4"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.img
            src="/amalgated-lending-logo.png"
            alt=""
            className="h-full w-full object-contain"
            loading="eager"
            decoding="async"
            fetchpriority="high"
            width={128}
            height={128}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: [1, 1.03, 1] }}
            transition={{
              opacity: { duration: 1.1, delay: 0.35, ease: 'easeOut' },
              scale: { duration: 2.6, delay: 0.8, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="text-center text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Amalgated Lending Inc.
          </h1>
          <motion.div
            className="h-0.5 w-16 rounded-full bg-[#dc2626] sm:w-20"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.35, delay: 0.7 }}
            style={{ transformOrigin: 'center' }}
          />
          <p className="mt-2 text-center text-sm text-white/70">
            Trusted Lending Solutions
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}
