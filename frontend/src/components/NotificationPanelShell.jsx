import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock.js'

const MOBILE_MQ = '(max-width: 639px)'

/**
 * Notification dropdown shell: full-viewport panel on mobile (portaled to body
 * so portal-shell overflow-hidden does not clip it), anchored dropdown on sm+.
 */
export function NotificationPanelShell({
  open,
  onClose,
  anchorRef,
  title,
  titleId,
  headerActions = null,
  children,
}) {
  const panelRef = useRef(null)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia(MOBILE_MQ).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia(MOBILE_MQ)
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useBodyScrollLock(open && isMobile)

  useEffect(() => {
    if (!open) return undefined
    const onDocClick = (e) => {
      const inAnchor = anchorRef?.current?.contains(e.target)
      const inPanel = panelRef.current?.contains(e.target)
      if (!inAnchor && !inPanel) onClose()
    }
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open, onClose, anchorRef])

  const panelClasses = [
    'flex max-h-[min(78dvh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-5.5rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#1F2937] dark:bg-[#111827]',
    isMobile
      ? 'fixed left-3 right-3 top-[max(4.25rem,calc(env(safe-area-inset-top,0px)+3.25rem))] z-[90] w-auto max-w-none'
      : `absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(30rem,calc(100vw-1.5rem))] origin-top-right transition-all duration-200 ${
          open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
        }`,
  ].join(' ')

  const panel = (
    <div
      ref={panelRef}
      role="region"
      aria-labelledby={titleId}
      aria-hidden={!open}
      {...(!open ? { inert: '' } : {})}
      className={panelClasses}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-[#1F2937] sm:px-4 sm:py-3">
        <h2 id={titleId} className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        {headerActions}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2.5 sm:p-3">
        {children}
      </div>
    </div>
  )

  if (isMobile) {
    if (!open || typeof document === 'undefined') return null
    return createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[85] bg-slate-950/30 backdrop-blur-[1px]"
          aria-label="Close notifications"
          onClick={onClose}
        />
        {panel}
      </>,
      document.body,
    )
  }

  return panel
}
