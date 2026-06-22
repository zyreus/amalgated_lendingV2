import { useEffect, useId, useRef } from 'react'

/**
 * Accessible confirm / info modal (replaces window.confirm).
 * Styling matches Amalgated Lending admin/borrower surfaces: red primary, neutral card.
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
  /** When false, only the primary button is shown (info / success dialogs). */
  showCancel = true,
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

  const overlay =
    'fixed inset-0 z-[120] flex items-end justify-center overflow-y-auto overflow-x-hidden bg-black/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center sm:p-6'

  const panel =
    'w-full max-w-md rounded-2xl border border-gray-200 border-t-[3px] border-t-brand-primary bg-white p-6 shadow-2xl transition-colors duration-300 dark:border-[#1F2937] dark:border-t-brand-primary dark:bg-[#111827]'

  const eyebrowCls =
    'text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-primary'

  const titleCls = 'text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100'

  const messageCls = 'mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-300'

  const primaryBtn =
    'touch-manipulation min-h-[44px] rounded-xl border-0 bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white outline-none ring-0 shadow-none transition-colors hover:bg-brand-primary-hover active:bg-brand-primary-hover focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60'

  const secondaryBtn =
    'touch-manipulation min-h-[44px] rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#374151] dark:bg-[#1F2937] dark:text-gray-100 dark:hover:bg-[#374151]'

  return (
    <div
      className={overlay}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? descId : undefined}
        className={panel}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {showCancel ? <p className={eyebrowCls}>Confirm action</p> : null}
        <h2 id={titleId} className={`${titleCls}${showCancel ? ' mt-2' : ''}`}>
          {title}
        </h2>
        {message ? (
          <p id={descId} className={messageCls}>
            {message}
          </p>
        ) : null}
        <div
          className={`mt-6 flex flex-wrap gap-3 ${showCancel ? 'justify-end' : 'justify-center sm:justify-end'}`}
        >
          {showCancel ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel?.()}
              className={secondaryBtn}
            >
              {cancelLabel}
            </button>
          ) : null}
          <button
            ref={okRef}
            type="button"
            disabled={busy}
            onClick={() => {
              if (showCancel) {
                onCancel?.()
                void Promise.resolve(onConfirm?.()).catch(() => {})
                return
              }
              onConfirm?.()
            }}
            className={primaryBtn}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
