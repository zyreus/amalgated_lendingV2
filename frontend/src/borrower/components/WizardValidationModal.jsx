import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

export default function WizardValidationModal({ open, grouped = [], onClose, onReview }) {
  const dialogRef = useRef(null)
  const reviewBtnRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const prev = document.activeElement
    const t = setTimeout(() => reviewBtnRef.current?.focus(), 50)

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose?.()
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        if (!focusable.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKeyDown)
      if (prev && typeof prev.focus === 'function') prev.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6" role="presentation">
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-[rgba(0,0,0,0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wizard-validation-title"
            aria-describedby="wizard-validation-desc"
            className="relative z-[81] flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#111827]"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#F59E0B]">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 id="wizard-validation-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Incomplete Application
                </h2>
                <p id="wizard-validation-desc" className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Please complete the required information before proceeding to the next step.
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  Below are the fields that still require your attention.
                </p>
              </div>
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-4">
                {grouped.map((group) => (
                  <section key={group.section}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                      {group.section}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((item) => (
                        <li
                          key={`${group.section}-${item.type}-${item.key}`}
                          className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200"
                        >
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#DC2626]" aria-hidden />
                          <span>{item.label}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-200"
              >
                Close
              </button>
              <button
                ref={reviewBtnRef}
                type="button"
                onClick={onReview}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#DC2626] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Review Missing Items
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
