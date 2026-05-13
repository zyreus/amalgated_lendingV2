import { useEffect } from 'react'

/**
 * Locks document scrolling while `locked` is true (e.g. mobile nav drawer open).
 * Restores the previous inline overflow on cleanup.
 */
export function useBodyScrollLock(locked) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])
}
