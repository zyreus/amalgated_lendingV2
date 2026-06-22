import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { admin } from './AdminUi.jsx'

const CONFIRM_BTN_BY_TONE = {
  danger: admin.btnPrimary,
  default: admin.btnPrimary,
  primary: admin.btnPrimary,
  success: admin.btnPrimary,
}

/**
 * Inline confirmation dialog (replaces window.confirm) — matches admin modal surfaces.
 * Closes immediately on confirm; the action runs in the background so SMTP/queue work
 * does not keep the modal on a loading spinner.
 */
export default function ConfirmModal({
  open,
  onClose,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const confirmClass = CONFIRM_BTN_BY_TONE[tone] || CONFIRM_BTN_BY_TONE.primary

  const handleConfirm = () => {
    onClose()
    void Promise.resolve(onConfirm()).catch(() => {
      // Caller shows toast and rethrows when needed.
    })
  }

  const node = (
    <div
      className={admin.modalOverlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`${admin.modalCard} max-w-md`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className={admin.modalEyebrow}>Confirm action</p>
        <h2 id="confirm-modal-title" className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p id="confirm-modal-desc" className={`mt-2 text-sm leading-relaxed ${admin.textMuted}`}>
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={admin.btnSecondary} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClass} onClick={handleConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
