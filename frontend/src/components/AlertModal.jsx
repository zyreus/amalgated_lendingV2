import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { admin } from '../admin/components/AdminUi.jsx'

const EYEBROW_BY_VARIANT = {
  success: 'Success',
  error: 'Error',
  info: 'Notice',
}

/**
 * Centered feedback modal (replaces corner toasts / inline banners for action results).
 */
export default function AlertModal({ open, message, variant = 'info', onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !message) return null

  const eyebrow = EYEBROW_BY_VARIANT[variant] || EYEBROW_BY_VARIANT.info
  const panelClass =
    variant === 'error'
      ? 'rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm leading-relaxed text-red-900 dark:border-red-800/40 dark:bg-red-950/30 dark:text-red-100'
      : variant === 'success'
        ? admin.modalSuccessPanel
        : 'rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-800 dark:border-[#1F2937] dark:bg-[#0F172A]/50 dark:text-gray-100'

  const node = (
    <div
      className={`${admin.modalOverlay} z-[250]`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        className={`${admin.modalCard} max-w-md`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="alert-modal-message"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className={admin.modalEyebrow}>{eyebrow}</p>
        <div id="alert-modal-message" className={`mt-3 ${panelClass}`}>
          {message}
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" className={admin.btnPrimary} onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
