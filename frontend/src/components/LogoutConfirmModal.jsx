import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function LogoutIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  )
}

function Spinner({ className }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/**
 * Premium logout confirmation modal — white card, red destructive actions.
 * Mounted once via LogoutConfirmProvider (portal to document.body).
 */
export default function LogoutConfirmModal({ open, busy = false, onCancel, onConfirm }) {
  const titleId = useId()
  const descId = useId()
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const lastFocusedRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    lastFocusedRef.current = document.activeElement
    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    const t = window.setTimeout(() => cancelRef.current?.focus(), 50)
    return () => {
      window.clearTimeout(t)
      body.style.overflow = prevOverflow
      if (lastFocusedRef.current instanceof HTMLElement && document.contains(lastFocusedRef.current)) {
        lastFocusedRef.current.focus()
      }
    }
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        e.preventDefault()
        onCancel?.()
        return
      }
      if (e.key !== 'Tab' || !panelRef.current) return
      const nodes = [...panelRef.current.querySelectorAll(FOCUSABLE)]
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  if (!open) return null

  return createPortal(
    <div
      className="logout-modal-backdrop fixed inset-0 z-[130] flex items-end justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="logout-modal-panel w-full max-w-[22rem] rounded-2xl border border-gray-100 border-t-[3px] border-t-brand-primary bg-white p-6 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.18)] sm:max-w-md sm:p-8"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 ring-1 ring-brand-primary/20"
            aria-hidden
          >
            <LogoutIcon className="h-6 w-6 text-brand-primary" />
          </div>
          <h2 id={titleId} className="mt-5 text-center text-xl font-semibold tracking-tight text-gray-900">
            Log Out?
          </h2>
          <p id={descId} className="mt-2 text-center text-sm leading-relaxed text-gray-600">
            Are you sure you want to log out of your account?
          </p>
        </div>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
            className="touch-manipulation min-h-[44px] flex-1 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:min-w-[7.5rem]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="touch-manipulation min-h-[44px] flex flex-1 items-center justify-center gap-2 rounded-xl border-0 bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary-hover active:bg-brand-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:min-w-[9.5rem]"
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4" />
                <span>Logging out…</span>
              </>
            ) : (
              'Yes, Log Out'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
