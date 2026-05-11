import { Suspense, useEffect, useRef, useState } from 'react'

/**
 * `LazySection` defers rendering of a heavy below-the-fold section until it is
 * about to enter the viewport. Combined with `React.lazy`, this means the JS
 * chunk for the section is also fetched on-demand, slashing initial payload
 * for the homepage / long landing pages.
 *
 * Usage:
 *   const FaqSection = lazy(() => import('./home/FaqSection.jsx'))
 *   <LazySection minHeight={320}><FaqSection /></LazySection>
 */
export default function LazySection({
  children,
  rootMargin = '320px 0px',
  minHeight = 240,
  fallback = null,
  className = '',
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (visible) return undefined

    /** SSR / very old browsers — render immediately. */
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return undefined
    }

    const node = ref.current
    if (!node) return undefined

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            io.disconnect()
            break
          }
        }
      },
      { rootMargin },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [rootMargin, visible])

  return (
    <div
      ref={ref}
      className={className}
      style={!visible ? { minHeight: typeof minHeight === 'number' ? `${minHeight}px` : minHeight } : undefined}
    >
      {visible ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  )
}
