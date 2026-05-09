import { useEffect, useId, useRef } from 'react'

/**
 * Custom confirm modal (replaces window.confirm) — cream panel, pill OK/Cancel per borrower UI spec.
 */
export default function ConfirmDialog({
  open,
  title = 'Confirm',
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  busy = false,
}) {
  const titleId = useId()
  const descId = useId()
  const okRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel])

  useEffect(() => {
    if (open) okRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-md rounded-[28px] bg-[#fcfdf8] p-7 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.22),0_0_0_1px_rgba(0,0,0,0.04)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-bold text-gray-900">
          {title}
        </h2>
        <p id={descId} className="mt-3 text-[15px] leading-relaxed text-gray-900">
          {message}
        </p>
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <button
            ref={okRef}
            type="button"
            disabled={busy}
            onClick={() => onConfirm?.()}
            className="min-h-[44px] rounded-full bg-[#1B4332] px-7 text-sm font-bold text-white shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#1B4332] transition hover:bg-[#2d6a4f] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel?.()}
            className="min-h-[44px] rounded-full bg-[#d8f3dc] px-7 text-sm font-semibold text-gray-900 transition hover:bg-[#c7f0db] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
