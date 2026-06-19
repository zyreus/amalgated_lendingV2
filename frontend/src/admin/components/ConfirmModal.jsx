import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { admin } from './AdminUi.jsx'
import LoadingButton from '../../components/loading/LoadingButton.jsx'
import { LOADING_LABELS } from '../../components/loading/loadingLabels.js'

/**
 * Inline confirmation dialog (replaces window.confirm) — matches admin modal surfaces.
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
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, busy])

  useEffect(() => {
    if (!open) setBusy(false)
  }, [open])

  if (!open) return null

  const confirmClass =
    tone === 'danger'
      ? admin.btnPrimary
      : 'rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition duration-200 hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white'

  const handleConfirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  const deleting = busy && /delete/i.test(String(confirmLabel))
  const confirmLoadingText = deleting ? LOADING_LABELS.delete : LOADING_LABELS.confirm

  const node = (
    <div
      className={admin.modalOverlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
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
        <h2 id="confirm-modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p id="confirm-modal-desc" className={`mt-2 text-sm ${admin.textMuted}`}>
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={admin.btnSecondary} onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <LoadingButton
            type="button"
            className={confirmClass}
            loading={busy}
            loadingText={confirmLoadingText}
            minWidth="7.5rem"
            onClick={() => void handleConfirm()}
          >
            {confirmLabel}
          </LoadingButton>
        </div>
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
